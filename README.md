# Cloud Native Functional Programming with AWS Lambda
In this post I would like to share architecture and programming pattern I've been using to build Cloud Native application. The usecase I'm going to present is a Serverless REST application deployed in AWS. I want to show how by adopting specific AWS components and programming paradighms we can increase the reliablility of the applications we write, while also increasing their mainteinability.

In particular I'm going to focus on AWS Lambda and Functional Programming (FP).

If you are already familiar with FP and already know concepts like currying, monads, either, task, then feel free to skip a few sections and go to __Composing the Service__.
If you are only interested in running a working example you can find the code in this [repository](https://github.com/riccardomocchetti/functional-programming-with-aws-lambda).

## Why Functional Programming (FP)
Whenever you talk to an experienced functional programmer, you watch a keynote or you read about FP on other blog posts, people tend to list the benefits of adopting FP as follows. 

- Functions are easier to reason about;
- Programs are easier to comprehend because are written at a higher level;
- Testing is easier;
- Parallel programming is easier.
  
And many others [[1]](https://alvinalexander.com/scala/fp-book/benefits-of-functional-programming).

This sounds great, everyting is easier, but it does not come for free.

What I would like to show in this post is that to actually benefit from FP, we need to change how we think and write code.
I would like to describe what my thought process is like when I write a program, and that by applying a few principles we can actually see the benefits listed above.

## Why AWS Lambda
AWS Lambda is a fully managed environment where we can run our code (with some limits). 

The model is really simple. Our code is deployed in what it's called a lambda function. Whenever a lambda function receives an event from one of the supported AWS services, it triggers our code passing the event as a parameter.

It sounds perfect! FP is all about defining our program as functions, so AWS Lambda gives us the right abstraction to interact with other AWS services. Everithing is an event that we receive as a parameter.

One of the most common usage of AWS Lambda is in conjuntion with AWS API Gateway to build a REST application. The API Gateway deals with receiving, parsing and potentially validating a requests. The request is passed to a lambda function as an event, and triggers its execution.

We can already see an advantage of using this model when we develop our REST application. The logic for receiving and parsing an HTTP request is already implemented, we don't have to think about it. All we are interested in is our event input and the business logic we need to implement.

This can also be extended to other AWS services, for example AWS SQS/SNS where we don't have to implement the logic to retrieve messages from the queue/topic, and so on.

## A Real Example
Enough with the chit-chat, let's focus on a _real_ application and let's see what it means to write it in FP and run it in AWS Lambda.

This application is a really simple one, the backend for a blog. It offers a REST API that allows two operations:

- `POST /blogposts` to create a blog post;
- `GET /blogposts` to retrieve the full list of posts.

## Request Validation
One of the first things I think about when writing a REST application is how I want to validate requests coming from the user.

AWS Lambda helps us here because an HTTP request is just an event. In particular one that looks like this.

```typescript
{
  body: '{ "some": "text" }',
  queryStringParameters: { "param": "queryParam" },
  pathParameters: { "param": "pathParam" },
  httpMethod: 'POST',
  path: '/blogposts'
}
```

So what do we do in our function when we receive something like this? The idea is pretty much always the same.

A request comes in. It goes through a validator. If the validation passes then the request is allowed to proceed. Otherwise an error message is returned to the user.

This looks very simple at a first glance but it can become quite complex depending on the type of validation. The risk is that our validator function becomes big, difficult to maintain and not reusable.

The answer I found to this problem is __function composition__.
 
## Function Composition
> Function composition is the process of applying a function to the output of another function [[2]](https://medium.com/@gigobyte/implementing-the-function-composition-operator-in-javascript-e2c4f1847d6a)

The definition suggests we can break down the function that validates the whole payload into smaller functions, each validating a part of the payload, that we can then compose together. 

The advantage of following this approach is that we can think about our smaller functions in a way that is reusable. We can then build our request validation from small building blocks, like we would do when playing with LEGO blocks.

Let's say we want to implement validation for the `POST /blogposts` request, and that the request is valid if:
- There is no path parameters;
- There is no query parameters;
- We can parse the request body without errors.

Other rules to test the validity of the request body can be easily implemented with additional functions. For now we are going to focus on the principle of Function Composition.

We could implement our validation rules with the three functions below.

```typescript
const queryParamsIsNull = (event: APIGatewayEvent) => {
  if (event.queryStringParameters !== null) {
    throw new ApplicationError(
      'Error parsing request query params',
      ['Query params should be empty'],
      StatusCodes.BAD_REQUEST
    );
  }
  return event;
};

const pathParamsIsNull = (event: APIGatewayEvent) => {
  if (event.pathParameters !== null) {
    throw new ApplicationError(
      'Error parsing request path params',
      ['Path params should be empty'],
      StatusCodes.BAD_REQUEST
    );
  }
  return event;
};

const asUserPostEvent = (event: APIGatewayEvent) => {
  try {
    const parsedBody = event.body
      ? JSON.parse(event.body)
      : {};
    return {
      ...event,
      body: parsedBody
    };
  } catch (error) {
    throw new ApplicationError(
      'Error parsing request body',
      ['Invalid JSON'],
      StatusCodes.BAD_REQUEST
    );
  }
};
```

The three functions we just wrote have a few properties that is worth noting. They:
- are generic enough to be applied to every request that is coming into our application;
- take the whole event as a parameter and they focus on the event attribute they are validating;
- can be combined together like a chain. 

`queryParamsIsNull` and `pathParamsIsNull` take the `event` as input and return the `event` if the validation is successful. Furthermore they can be called in any order. 

The last ring of our chain is going to be `asUserPostEvent`. It parses the `body` of our request and returns the parsed body along with all other request parameters.

The validation function for the `POST /blogposts` request can be written as composition of our three functions.

```typescript
const validateCreatePostEvent = compose(asUserPostEvent, queryParamsIsNull, pathParamsIsNull);
```

`compose` is a utility function present in most FP frameworks that helps us specifying function composition more elegantly.

We could also write our validation function without the `compose` helper in a less readable, but more explicit fashion.

```typescript
const validateCreatePostEvent = (event: APIGatewayEvent) => 
  asUserPostEvent(queryParamsIsNull(pathParamsIsNull(event)))
```

The two definitions are equivalent. If we look closely at our second definition of `validateCreatePostEvent` we notice that the functions we pass to the `compose` helper are applied from right to left.

## Handling Exceptions
I need to be completely honest, in the previous section I didn't tell you the whole truth. The examples I used are really useful to explain composition, but they all have a major issue. They all produce a __side effect__.

> A side effect is a change of system state or observable interaction with the outside world that occurs during the calculation of a result. [[3]](https://mostly-adequate.gitbooks.io/mostly-adequate-guide/ch03.html#side-effects-may-include)

In every example we've seen so far, whenever we want to fail, we throw an exception. This means that we lose control of the program flow. The exception needs to be picked up buy something else, and that something else has to deal with it.

The most common example I've found in my experience, is when I want to show an error message to the user of an application written in one of the many web frameworks available. The usual approach is to define exceptions to inherit from a particular class that translates the exception into an HTTP response at runtime.

This introduces the problem that the correctness of the program depends on something else. It makes the program harder to test because I can't just rely on my inputs anymore. Furthermore, it makes the program less readable because in order to understand how the program behaves, I can't just look at the function itself but I need to consider the context in wich the function runs.

So how do we avoid this? How can we write our program so that we don't create side effects? How do we return different values depending on the result of the validation? How do we compose our functions so that we have one single flow independently of the result of the validation?

## Either Left or Right
The first step we need to make to eliminate side effects is to rewrite our functions so that they don't throw exceptions. Let's have a look at the following example.

```typescript
const bodyNotNull = (event: APIGatewayEvent) => {
  if (event.body === null) {
    return new ApplicationError(
      'Error parsing request body',
      ['Body cannot be empty'],
      StatusCodes.BAD_REQUEST
    );
  }
  return event;
};
```

The `bodyNotNull` function returns an `ApplicationError` instead of throwing it like an exception. This function does not have side effects anymore, it always returns something, and the output depends only on the input. Unfortunately it is not the best function to deal with, since it does not have a consistent interface.

What we need is to return something that can behave either as an `APIGatewayEvent` or as an `ApplicationError`. Read this 10 times. In FP such a thing exists, and it takes the name of, unsurprisingly, __Either__[[4]](https://mostly-adequate.gitbooks.io/mostly-adequate-guide/ch08.html#pure-error-handling). 

`Either` assumes a `Left` value or a `Right` value. Conventionally the `Left` value represents an error state while the `Right` value represent a successful computation.

We can now rewrite the validation function to use this new concept.

```typescript
const bodyNotNull = (event: APIGatewayEvent): Either<ApplicationError, APIGatewayEvent> => {
  if (event.body === null) {

    // We failed the validation, so we return a Left value
    return left(
      new ApplicationError(
        'Error parsing request body',
        ['Body cannot be empty'],
        StatusCodes.BAD_REQUEST
      )
    );
  }

  // Our validation passed, so we return a Right value
  return right(event);
};
```

If we take a closer look at the return type of the `bodyNotNull` function, we can see that we return an `Either` that can assume both an `ApplicationError` or an `APIGatewayEvent` value. We provide the real value to our `Either` when we pass an instance of `ApplicationError` to the `left` function, or our `event` to the `right` function.

The disadvantage of introducing the `Either` is that now we can no longer compose our validation function like

```typescript
const validateCreatePostEvent = compose(asUserPostEvent, queryParamsIsNull, pathParamsIsNull);
```

This is because our functions now expect an `APIGatewayEvent` as an input but return an `Either<ApplicationError, APIGatewayEvent>`, and our compiler would not be happy about it.

We need a new way to compose our functions together.

## Functions as Chains

If you ask a mathematician "I need to chain a series of functions together, but I also need to capture their errors" you would probably receive this answer: "Oh that's easy, just use a monad!". Our mathematician is correct, unfortunately when I heard this answer for the first time it didn't really make sense to me. 

I'm going to summarise in a few words the way I think about monads hoping that it might help who, like me, comes from an imperative programming style. This is an extreme semplification of the definition of a monad and I think FP purists will turn their noses up, but I think it's good enough if you want to start using monads in your application.

I see a monad as a container of one item. This container has three parts:
1. a type that describes the behavior of the container;
2. a constructor to build a container with an item in it;
3. one or more operations to combine (compose) monads with each other. Each combinator generates a new monad from the item contained in it.

Each part also needs to respect a few mathematical laws. I won't go into more details. If you feel adventurous you can read all about monads in this paper [[5]](http://bit.ly/monad-paper).

The constructor is generally called `of`. When we do `A.of(val)` we create a monad of type `A` that contains the value `val`. The combinators I find myself using more often are `map` and `chain`.

`map` takes a function as a parameter and returns a new monad containing the output of the function.

`chain`, also known as `flatMap`, is similar to `map` but expects the input function to return the new monad.

Good. So, now what? Why is this useful?

You will be glad to know that `Either` is a monad. And it behaves in a particular way.

> Each combinator (`map`, `chain`) of the `Either` monad is applied only if the `Either` contains a `Right` value. If the `Either` contains a `Left` value, it is returned untouched.

Let's see how we can use the `Either` monad to compose our validation functions together.

```typescript
export const validateCreatePostEvent = (event: APIGatewayEvent) =>
  either.of<ApplicationError, APIGatewayEvent>(event)
    .chain(pathParamsIsNull)
    .chain(queryParamsIsNull)
    .chain(bodyNotNull)
    .chain(asUserPostEvent);
```

With `either.of(event)` we create a new `Either` monad containing the Api Gateway event. We then `chain` toghether each validation function. Remember every validation function takes the `event`, which is contained in the `Either`, and returns an `Either`. 

When a new event goes through the chain, each function will be applied as long as the previous functon returned a `Right`. If, for any reason, a validation rule fails, it will produce a `Left` value that will be propagated to the end of the chain. 

## Calling the Database
So far, we have looked at how we can remove side effects from functions that interact only with in memory variables. But when we write a real application we often need to call external services, or a database to store our data.

FP tells us that the execution of our functions must return the same output if we provide the same input. However, when we interact with a database, more often than not, our output depends on the input of the function and on the state of the database. So how do we respect FP rules(?) without giving up on storing and retrieving our precoius data?

The answer FP gives us is really simple, delegation. Let's see how.

```typescript
const storeById(id: string, data: object) => db.store({...data, id})

const storeByIdDelegated(id: string, data: object) => () => db.store({...data, id})
```

Instead of calling directly the database like we do in `storeById` we return a function that calls the database, like in `storeByIdDelegated`. Now for every pair of `id, data` we return the function that stores `id, data` in the database, so technically we are returning the same output for the same input. Except this is not really usefull isn't it?

It actually is, let's have a look at the following example.

```typescript
task.of(2).map(two => two + 4).map(console.log)
```

We are creating a monad of type `Task`(we don't know yet what it does), with `2` contained in it. We then map `2` to a function that adds `4` to it and then we log the returned value. What we expect see `6` on our screen.

If you run this in the console you'll be surprised, nothing is returned. However if we do

```typescript
task.of(2).map(two => two + 4).map(console.log).run()
```

and we call `run()`, we actually see the value `6` showing. This is because `Task` is part of a particular kind of monads called __IO__. 

IO is a generic FP interface that lets interact with external components like we would do normally, but under the hood it composes all our functions together like snow building up on a mountain, ready to be unleashed as soon as we make some noise.

`Task` also offer us a nicer interface for when we need to interact with the database in an asynchronous fashion. Using `Promose`, or `Future` if you are familiar with scala.

However, our database is going to fail from time to time, so it is better to use a `TaskEither` to also capture failure scenarios.

Our function to store a blog post looks like this:

```typescript
const createPostIO = (database: DB) => (event: UserPostEvent) =>
  tryCatch<ApplicationError, UserPost>(
    () => database.createPost(event.body),
    reason => new ApplicationError(
      'Error storing item',
      [reason as string],
      StatusCodes.SERVER_ERROR)
  )
```

A few things to note:
- we pass the `database` as a parameter, this is particularly useful for testing;
- `tryCatch` is a utility method to create `TaskEither` monads. The first parameter is our `Right` value. The second parameter our `Left` value. We want return the post if we created successfully, otherwise we return an error.

I'm using a tecnique called [currying]() to define `createPostIO`. It allows me to fix the first parameter and do things like.

```typescript
const createPostWithDynamoDB = createPostIO(dynamoDB)

const createPostWithMock = createPostIO(mockDB)
```

This way I can preserve the behaviour and only change the implementation of my database. Really useful for testing.

## Composing the Service 
In the previous sections we looked at how to use `Either` to do validation and how to use `TaskEither` to send requests to our database. These two monads allow us to define both successful behaviours and error behaviours of our application without introducing any side effect in our code. 

Our functions look pretty much like this.

```typescript
const validateCreatePostEvent = (event: APIGatewayEvent) =>
  either.of<ApplicationError, APIGatewayEvent>(event)
    .chain(pathParamsIsNull)
    .chain(queryParamsIsNull)
    .chain(bodyNotNull)
    .chain(asUserPostEvent);
    
const createPostIO = (database: DB) => (event: UserPostEvent) =>
  tryCatch<ApplicationError, UserPost>(
    () => database.createPost(event.body),
    reason => new ApplicationError(
      'Error storing item',
      [reason as string],
      StatusCodes.SERVER_ERROR)
  )
```

If we try to chain these two functions together our compiler is not happy because `Either` and `TaskEither` are two different types. The easiest and more consistent way to fix this is to exploit the fact that we can use `TaskEither` for in memory variables as well, and update the definition of the validation functions.

```typescript
const validateCreatePostEvent = (event: APIGatewayEvent) =>
  taskEither.of<ApplicationError, APIGatewayEvent>(event)
    .chain(pathParamsIsNull)
    .chain(queryParamsIsNull)
    .chain(bodyNotNull)
    .chain(asUserPostEvent);
```

Every function returns a `TaskEither` now and we can start looking at the bigger picture. The next step now is to take a `POST /blogposts` event, validate it and store the blog post into our database. Being now masters of function composition we can simply write 

```typescript
const createPost = (event: APIGatewayEvent, database: DB) =>
  taskEither.of<ApplicationError, APIGatewayEvent>(event)
    .chain(validateCreatePostEvent)
    .chain(createPostIO(database))
```

Our new `createPost` function is now ready to take the event and queue all our validation and database interaction ready for something to execute `run()`. But what happens if we execute it now? What is the user going to see if we succede? And what if we fail?

`TaskEither` offers us another interface where we can specify what happens in case our value is `Right` or `Left`. This interface is the `fold` method.

```typescript
const createPost = (event: APIGatewayEvent, database: DB) =>
  taskEither.of<ApplicationError, APIGatewayEvent>(event)
    .chain(validateCreatePostEvent)
    .chain(createPostIO(database))
    .fold(
      errorResponse,
      successResponse(StatusCodes.CREATED)
    );
```

`fold` will merge our two branches `Left` and `Right` into one outcome. If our computation fails, `fold` will execute the function passed as first parameter, otherwise it will execute the second function.

At this point we have our first service ready. We can deal with all requests to store new posts in a way that is:
- reliable
- easy to read
- easy to test
- easy to extend

How to deal with `GET /userposts` requests can be defined using the same principles.

## Running the Application Locally

Now that we have our services ready we can see how we can configure AWS Lambda to run our code. We have to

1. Tell AWS Lambda what function to call when an event is received
2. Deploy our solution locally so we can see it in action
3. Deploy our solution in AWS

When we define how our code runs in AWS Lambda one of the parameters we are allowed to specify is the `handler`. The handler is the function that AWS Lambda will call whenever an event is received.

```typescript
// Here we define what database to use when an event is received
const db = DB.inMemory();

export const createPostHandler = (event: APIGatewayEvent) =>
  createPost(event, db).run();
```

Our handler takes the API Gateway event as an input and triggers the execution of the `TaskEither` calling the `run()` function.

There are lot of frameworks to deploy AWS Lambda in conjunction with AWS Api Gateway both locally and in the AWS cloud. The one I'm using for this specific use-case is the __AWS Serverless Application Model (SAM)__[[6]](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/what-is-sam.html).

SAM allows us to configure your whole application in a file called `template.yaml`

```yaml
Transform: 'AWS::Serverless-2016-10-31'

Globals:
  Function:
    Runtime: nodejs8.10
    Timeout: 10
    Tracing: Active

Resources:
  
  CreatePostFunction:
    Type: 'AWS::Serverless::Function'
    
    Properties:
      CodeUri: ./dist
      Handler: main.createPostHandler
      
      Events:
        ListPostsApi:
            Type: Api
            Properties:
                Path: /posts
                Method: POST
```

This configuration tells SAM a few generic things about the application like the runtime environment. It also specifies the interaction beteween API Gateway and AWS Lambda by pairing HTTP methods to different handlers. Each handler is deployed in its own lambda function.

Once we have our configuration ready we can run the application locally by executing

```bash
sam local start-api
```

SAM also offers a way to deploy the application. The process is similar to an AWS CLoudFormation deploy. 

The template is first packaged and pushed to ans S3 bucket.

```bash
$ sam package --template-file sam.yaml --s3-bucket mybucket --output-template-file packaged.yaml
```

It is then picked up and deployed.

```bash
$ sam deploy --template-file ./packaged.yaml --stack-name mystack --capabilities CAPABILITY_IAM
```

I won't go into more details about the application deployment in this post as it is a topic on its own. It is worth noting that SAM comes with built-in __gradual code deployment__[[7]](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/automating-updates-to-serverless-apps.html), a way to reliably deploy your application with techniques like canary deployents and automatic rollbacks.
