# Cloud Native Functional Programming with AWS Lambda
In this post, I would like to share the architecture and programming pattern I've been using to build Cloud Native applications. The use-case I'm going to present is a Serverless REST application deployed in AWS. I want to show how by adopting specific AWS components and programming paradigms, we can increase the reliability of the applications we write, while also growing their maintainability.

In particular, I'm going to focus on AWS Lambda and Functional Programming (FP).

If you are already familiar with FP and already know concepts like currying, monads, either, task, then feel free to skip a few sections and go to __Composing the Service__.

If you want, you can find the examples in the post and the whole application in this [repository](https://github.com/riccardomocchetti/functional-programming-with-aws-lambda). The code is written in Typescript and uses the [fp-ts](https://github.com/gcanti/fp-ts) library for the functional aspect.

## Why Functional Programming (FP)
Whenever you talk to an experienced functional programmer, you watch a keynote, or you read about FP on other blog posts, people tend to list the benefits of adopting FP as follows:

- functions are simpler  to reason about;
- programs are more straightforward to comprehend because they are written at a higher level;
- functions are easier to test;
- and many others [[1]](https://alvinalexander.com/scala/fp-book/benefits-of-functional-programming).

It all sounds great, everything is better, but it does not come for free.

What I would like to show in this post is that to benefit from FP, we need to change how we think and write code.
I want to describe what my thought process is like when I write a program, and that by applying a few principles, we can see the benefits listed above.

## Why AWS Lambda
AWS Lambda is a fully managed environment that runs our code (with some limits). 

The model is straightforward. We deploy our code in what it's called a lambda function. Whenever a lambda function receives an event from one of the supported AWS services, it triggers our code passing the event as a parameter.

It sounds perfect! FP is all about defining our program as functions, so AWS Lambda gives us a convenient abstraction to interact with other AWS services. Everything is an event that we receive as a parameter.

One of the most common uses of AWS Lambda is to receive events from  AWS API Gateway to build a REST application. The API Gateway deals with receiving, parsing and potentially validating requests. The request is passed to a lambda function as an event and triggers its execution.

We can already see the advantage of using this model when we develop our REST application. The API Gateway already implements the logic to process HTTP requests. We don't have to think about it. All we are interested in is our event input and the business logic we need to apply.

This model is also valid to interact with other AWS services. Another example is AWS SQS/SNS, where we don't have to implement the logic to retrieve messages from the queue/topic, and so on.

## A Real Example
All the examples in the post are going to be based on a _real_ application. This application is extremely simple, the backend for a blog. It offers a REST API that allows two operations:

- `POST /blogposts` to create a blog post;
- `GET /blogposts` to retrieve the full list of posts.

## Request Validation
One of the first things I think about when writing a REST application is how I want to validate requests coming from the user.

AWS Lambda helps us here because an HTTP request is just an event. In particular, one that looks like this.

```typescript
{
  body: '{ "some": "text" }',
  queryStringParameters: { "param": "queryParam" },
  pathParameters: { "param": "pathParam" },
  httpMethod: 'POST',
  path: '/blogposts'
  // plus other attributes
}
```

The pattern to implement validation is pretty much always the same.

A request comes in. It goes through a validation function or component. If the validation passes, then the request is allowed to proceed. Otherwise, we return an error message to the user.

Everything looks straightforward, but it can become quite complicated depending on the type of validation. The risk is that our validation function becomes big, difficult to maintain and not reusable.

The answer I found to this problem is __function composition__.
 
## Function Composition
> Function composition is the process of applying a function to the output of another function [[2]](https://medium.com/@gigobyte/implementing-the-function-composition-operator-in-javascript-e2c4f1847d6a)

This definition suggests we can break down the function that validates the whole payload into smaller functions, each validating a part of the payload, that we can then compose together. 

The advantage of following this approach is that we can think about our smaller functions in a reusable way. We can then put them all together as we would with building blocks when playing with LEGO blocks.

Let's say we want to implement validation for the `POST /blogposts` request, and that the request is valid if:
- there are no path parameters;
- there are no query parameters;
- we can parse the request body without errors.

If we wanted, we could implement other functions to check the correctness of the body, but this is good enough to explain how function composition works.

Here is a first implementation or our validation rules.

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

These three functions have a few properties that are worth noting.

- they are generic enough to be applied to every request;
- they take the whole event as a parameter
- they focus on the event attribute they are validating;
- the input of one function is the output of another function.

`queryParamsIsNull` and `pathParamsIsNull` take the `event` as input and return the `event` if the validation is successful.

 `asUserPostEvent` parses the `body` of our request and returns a new object containing the parsed body along with all other request parameters.

We can write the validation function for the `POST /blogposts` as the composition of our three functions.

```typescript
const validateCreatePostEvent = compose(asUserPostEvent, queryParamsIsNull, pathParamsIsNull);
```

Where `compose` is a utility function present in most FP frameworks that help us specifying function composition more elegantly.

We can also write our validation function without the `compose` helper in a less readable, but more explicit fashion.

```typescript
const validateCreatePostEvent = (event: APIGatewayEvent) => 
  asUserPostEvent(queryParamsIsNull(pathParamsIsNull(event)))
```

The two definitions are equivalent. If we look closely at our second definition of `validateCreatePostEvent`, we notice that `compose` applies functions from right to left.

## Handling Exceptions
I need to be completely honest. In the previous section, I didn't tell you the whole truth. The examples I used are convenient to explain the concept of composition, but they all have a significant issue. They all produce a __side effect__.

> A side effect is a change of system state or observable interaction with the outside world that occurs during the calculation of a result. [[3]](https://mostly-adequate.gitbooks.io/mostly-adequate-guide/ch03.html#side-effects-may-include)

In every example we've seen so far, whenever we want to fail, we throw an exception. Exceptions make us lose control of the program flow. The exception needs to be picked up by something else, and that something else has to deal with it.

This introduces the problem that the correctness of the program depends on something else. It makes the program harder to test because we can't just rely on our inputs anymore. Furthermore, it makes the program less readable because to understand how the program behaves, we can't just look at the function itself, but we need to consider the context in which the function runs.

So how do we avoid this? How can we write our program so that we don't create side effects? How do we return different values depending on the result of the validation and still maintain a usable interface? Moreover, how do we compose our functions so that we have one single flow independently of the result of the validation?

## Either Left or Right
The first step we need to make to eliminate side effects is to rewrite our functions not to throw exceptions. Let's have a look at the following validation rule.

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

The `bodyNotNull` function __returns__ an `ApplicationError` instead of throwing it like an exception. This function does not have side effects anymore, it always returns something, and the output depends only on the input. Unfortunately, it is not the best function to deal with since it does not have a consistent interface.

What we need is to return something that can behave either as an `APIGatewayEvent` or as an `ApplicationError`. Read it ten times. 

In FP such a thing exists, and it takes the name of, unsurprisingly, __Either__[[4]](https://mostly-adequate.gitbooks.io/mostly-adequate-guide/ch08.html#pure-error-handling). 

`Either` assumes a `Left` value or a `Right` value. The convention is that the `Left` value represents an error state, while the `Right` value represents a successful computation.

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

If we take a closer look at the return type of the `bodyNotNull` function, we can see that we return an `Either` that can assume both an `ApplicationError` or an `APIGatewayEvent` value. We return the real value of `Either` using the `left` and `right` functions.

The disadvantage of introducing `Either` is that now we can no longer compose our validation function like we were doing before. This is because the input parameters of our functions are not compatible anymore with the value they return.

We need a new way to compose our functions together.

## Functions as Chains

If you ask a mathematician _"How do I chain a series of functions together, and also capture their errors?"_ you would probably receive this answer: _"Oh, that's easy, just use a monad!"_.

Unfortunately, when I heard this answer for the first time, it didn't make sense to me. I'm going to summarise the way I think about monads hoping that it might help who, like me, comes from an imperative programming style. 

My definition is an extreme simplification of the definition of a monad, and I think FP purists will turn their noses up. However, I believe it's good enough if you want to start using monads in your application.

I see a monad as a container of one item. This container has three parts:
1. a type that describes the behaviour of the container;
2. a constructor to build a container with an item in it;
3. one or more operations to combine (compose) monads with each other. Each operation generates a new monad from the item contained in it.

Each one of the three parts also needs to respect a few mathematical laws. I won't go into more details. If you feel adventurous, you can read all about monads in this paper [[5]](http://bit.ly/monad-paper).

The constructor of a monad is generally called `of`. 

```typescript
MonadA.of(val)
```

creates a monad of type `MonadA` that contains the value `val`. 

To access `val` and operate on it we can use `map`. It takes a function as a parameter and returns a new monad containing the output of the function.


```typescript
MonadA.of(1).map(one => one + 1)
// gives us MonadA.of(2)
```

Another useful way to access `val` is to use `chain`. Also known as `flatMap`, is similar to `map` but expects the input function to return the new monad.

```typescript
MonadA.of(1).chain(one => Monad.of(one + 1))
// gives us MonadA.of(2)
```

Good. So, how are monads going to help us?

You will be glad to know that `Either` is a monad, and it behaves in a particular way.

> A `Left` value ignores any attempt to `map` or `chain` over it. A function is only applied to instances of `Right` values.

Let's see how we can use the `Either` monad to compose our validation functions together.

```typescript
export const validateCreatePostEvent = (event: APIGatewayEvent) =>
  either.of<ApplicationError, APIGatewayEvent>(event)
    .chain(pathParamsIsNull)
    .chain(queryParamsIsNull)
    .chain(bodyNotNull)
    .chain(asUserPostEvent);
```

`either.of(event)` creates a new `Either` monad containing the API Gateway event. We then `chain` together each validation function. Remember every validation function takes the `event`, which is contained in the `Either` and returns an `Either` so we cannot use `map`. 

Every function in the chain is applied to the event as long as the value returned is `Right`. When a validation function returns `Left`, every other function is ignored, and the error is returned at the end of the chain.

## Calling the Database
So far, we have seen how to remove side effects from functions that interact only with in-memory variables. However, when we write real applications, we often need to call external services or a database to store our data.

FP tells us that the execution of our functions must return the same output if we provide the same input. Although, when we interact with a database, the value we return often depends on the state of the database. So how do we maintain or code [pure](https://mostly-adequate.gitbooks.io/mostly-adequate-guide/ch03.html) without giving up on storing and retrieving our precious data?

The answer FP gives us is simple, delegation. Let's see how.

```typescript
const storeById(id: string, data: object) => 
  db.store({...data, id})

const storeByIdDelegated(id: string, data: object) => 
  () => db.store({...data, id})
```

Instead of calling the database directly as we do in the first function, we return a function that calls the database __with the parameters we receive__. 

For every pair `id, data`, we return the function that stores `id, data` in the database, so technically we are returning the same output given the same input. 

I know, this doesn't sound very useful. But let's see how FP makes use of it.

```typescript
task.of(2).map(two => two + 4).map(console.log)
```

We are creating a monad of type `Task` (we don't know what it does yet), with `2` contained in it. We then map `2` to a function that adds `4`  and then we log the returned value. We expect to see `6` on our screen.

If you run this in the console, you'll be surprised. Nothing is returned. It's as nothing ever happened. However, when we do

```typescript
task.of(2).map(two => two + 4).map(console.log).run()
```

we see that the value `6` is displayed. 

You might have guessed by now that `Task` is another monad. And you are right, but it belongs to a particular kind of monads called __IO__. 

IO is a generic FP interface that let us interact with external components as we would typically do. However, under the hood, it does not immediately execute our functions, but it wraps them with another function as we did with `storeByIdDelegated`.

`Task` specialises from IO in that it offers us a friendlier interface for when we need to interact with our database asynchronously.

Unfortunately, we cannot just use `Task`. It is best to assume that our database is going to fail from time to time, so to represent failure scenarios are going to use `TaskEither`, which combines the behaviour of `Task` and `Either`.

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
- we pass the `database` as a parameter. This is particularly useful for testing;
- `tryCatch` is a utility method to create `TaskEither` monads. The first parameter is our `Right` value. The second parameter, our `Left` value. We want to return the post if we created it successfully. Otherwise, we return an error.

I'm using a technique called [currying](https://mostly-adequate.gitbooks.io/mostly-adequate-guide/ch04.html) to define `createPostIO`. It allows me to fix the first parameter like In the following functions.

```typescript
const createPostWithDynamoDB = createPostIO(dynamoDB)

const createPostWithMockDB = createPostIO(mockDB)
```

This way, I can preserve the behaviour of `createPostIO` and only change the implementation of my database. Useful for testing.

## Composing the Service 
In the previous sections, we looked at how to use `Either` to do validation and `TaskEither` to send requests to our database. These two monads allow us to define both successful behaviours and error behaviours of our application without introducing any side effect in our code. 

We can write the validation function to use the `Either` monad.

```typescript
const validateCreatePostEvent = (event: APIGatewayEvent) =>
  either.of<ApplicationError, APIGatewayEvent>(event)
    .chain(pathParamsIsNull)
    .chain(queryParamsIsNull)
    .chain(bodyNotNull)
    .chain(asUserPostEvent);
```
The interaction with the database is implemented using the `TaskEither` monad. 

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

However, if we try to chain these two functions together, our compiler is not happy because `Either` and `TaskEither` are two different types. The easiest and more consistent way to fix this is to exploit the fact that we can also use `TaskEither` with in-memory variables and update the definition of the validation functions.

```typescript
const validateCreatePostEvent = (event: APIGatewayEvent) =>
  taskEither.of<ApplicationError, APIGatewayEvent>(event)
    .chain(pathParamsIsNull)
    .chain(queryParamsIsNull)
    .chain(bodyNotNull)
    .chain(asUserPostEvent);
```

Every function returns a `TaskEither` now. The next step is to implement the business logic for a `POST /blogposts` request. Being now masters of function composition we can write 

```typescript
const createPost = (event: APIGatewayEvent, database: DB) =>
  taskEither.of<ApplicationError, APIGatewayEvent>(event)
    .chain(validateCreatePostEvent)
    .chain(createPostIO(database))
```

Our new `createPost` function takes the event and queues all our validation and database interaction ready for somebody to call `run()`. But what happens if we execute it now? What is the user going to see if the operation succeed? And what if we fail?

`TaskEither` offers us another interface we can use to specify what happens in case our value is `Right` or `Left`. This interface is the `fold` method.

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

`fold` merges our two branches `Left` and `Right` into one outcome. If the computation fails, `fold` executes the function passed as the first parameter. Otherwise, it calls the second function.

At this point, we have our first service. We can deal with all requests to store new posts in a way that is:
- reliable
- easy to read
- easy to test
- easy to extend

We can use the same techniques and principles to evaluate `GET /userposts` requests.

## Handling Requests

Now that we have our services, we can see how to configure AWS Lambda to run our code. We have to:

1. tell AWS Lambda what function to call when an event is received
2. deploy our solution locally so we can see it in action
3. deploy our solution in AWS

When we create a new lambda function, one of the parameters we are allowed to specify is the `handler`. The handler is the function that the lambda function calls whenever an event is received.

```typescript
// We specify the database implementation
const db = DB.inMemory();

export const createPostHandler = (event: APIGatewayEvent) =>
  createPost(event, db).run();
```

Our handler takes the API Gateway event as input and triggers the execution of the `TaskEither` calling the `run()` function.

## Deploying the Application

There are many frameworks to deploy AWS Lambda in conjunction with AWS API Gateway, both locally and in the AWS cloud. The one I'm using for this specific use-case is the __AWS Serverless Application Model (SAM)__[[6]](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/what-is-sam.html).

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

This configuration tells SAM a few generic things about the application, like the runtime environment. 

It also specifies the interaction between API Gateway and AWS Lambda by coupling HTTP methods to different handlers. A different lambda function handles each method.

Once we have our configuration ready, we can run the application locally by executing.

```bash
sam local start-api
```

SAM also offers a way to deploy the application in the AWS cloud. The process is similar to an AWS CLoudFormation deploy. 

The template is first packaged and pushed to an S3 bucket.

```bash
$ sam package --template-file sam.yaml --s3-bucket mybucket --output-template-file packaged.yaml
```

It is then picked up and deployed.

```bash
$ sam deploy --template-file ./packaged.yaml --stack-name mystack --capabilities CAPABILITY_IAM
```

I won't go into more details about the application deployment in this post as it is a topic on its own. It is worth noting that SAM comes with built-in __gradual code deployment__[[7]](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/automating-updates-to-serverless-apps.html), a way to reliably deploy your application with techniques like canary deployments and automatic rollbacks.
