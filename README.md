# Cloud Native Functional Programming with AWS Lambda

## Why Functional Programming (FP)
Whenever you talk to an experienced functional programmer, you watch a keynote or you read about functional programming on other blog posts, 
people tend to list the following as benefits when you choose to adopt functional programming for your next project. 

- Functions are easier to reason about;
- Programs are easier to comprehend because are written at a higher level;
- Testing is easier;
- Parallel programming is easier.
  
And many others [[1]](https://alvinalexander.com/scala/fp-book/benefits-of-functional-programming).

This sounds great, everyting is easier, but it does not come for free.

What I would like to show in this post is that to actually benefit from functional programming, we need to change how we think and write code.
I would like to describe what my thought process is like when I write a program, and that by applying a few principles we can actually see the benefits listed above.


## Why AWS Lambda
AWS Lambda is a fully managed environment where we can run our code (with some limits). 

The model is really simple. The code is deployed in what it's called a lambda function. Whenever a lambda function receives an event (from one of the supported AWS services), it triggers our code passing the event as a parameter.

It sounds perfect! Functional programming is all about defining your program as functions, so AWS Lambda gives us the right abstraction to interact with other AWS services. Everithing is an event that we receive as a parameter.

One of the most common usage of AWS Lambda is in conjuntion with AWS API Gateway to build a REST application. The API Gateway deals with receiving, parsing and potentially validating a requests. The request is passed to a lambda function as an event, and triggers its execution.

We can already see an advantage of using this model when we develop our REST application. The logic for receiving and parsing an HTTP request is already implemented, we don't have to think about it. All we are interested in is our event input and the business logic we need to implement.

This can also be extended to other AWS services, for example AWS SQS/SNS where we don't have to implement the logic to retrieve messages from the queue/topic, and so on.

## A Real Example
Enough with the chit-chat, let's focus on a _real_ application and let's see what it means to write it in functional programming and run it in AWS Lambda.

This application is a really simple one, the backend for a blog. It offers a REST API that allows two operations:

- `POST /posts` to create a blog post;
- `GET /posts` to retrieve the full list of posts.

This [repository]() contains the application I use to showcase some of the principles in the next sections.

## Request Validation
One of the first things I think about when writing a REST application is how I want to validate requests coming from the user.

AWS Lambda helps us here because an HTTP request is just an event. In particular one that looks like this.

```typescript
{
  body: '{ "some": "text" }',
  queryStringParameters: { "param": "queryParam" },
  pathParameters: { "param": "pathParam" },
  httpMethod: 'POST',
  path: '/post'
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

Let's say we want to implement validation for the `POST /posts` request, and that the request is valid if:
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

The three functions we just wrote have a few properties that is worth noting.

They are generic enough to be applied to every request that is coiming into our application. They take the whole event as a parameter and they focus on the event attribute they are validating.

They can be combined together like a chain. 

`queryParamsIsNull` and `pathParamsIsNull` take the same input and return the `event` if the validation is successful and they can be called in any order. The last ring of our chain is going to be `asUserPostEvent` which parses the body in our request and returns the parsed body along with all other request parameters.

The validation function for the `POST /posts` request we can now be written as:

```typescript
const validateCreatePostEvent = compose(asUserPostEvent, queryParamsIsNull, pathParamsIsNull);
```

Where `compose` is a utility function present in most Functional Programming frameworks that helps us specifying function composition more elegantly.

We could write the function composition without the `compose` helper in a less readable fashion.

```typescript
const validateCreatePostEvent = (event: APIGatewayEvent) => 
  asUserPostEvent(queryParamsIsNull(pathParamsIsNull(event)))
```

If we look closely at our second definition of `validateCreatePostEvent` we notice that the functions we pass to the `compose` helper are applied from right to left.

## Handling Exceptions

I need to be completely honest, in the previous section I didn't tell you the whole truth. The examples I showed you are really useful to explain Composition, but they all have a major issue. They all produce a __side effect__.

> A side effect is a change of system state or observable interaction with the outside world that occurs during the calculation of a result. [[3]](https://mostly-adequate.gitbooks.io/mostly-adequate-guide/ch03.html#side-effects-may-include)

In every example we've seen so far, whenever we want to fail, we throw an exception. This means that we lose control of the program flow. The exception needs to be picked up buy something else, and that something else has to deal with it.

The most common example I've found in my experience is when you want to show an error message to the user of a spring boot application. You basically define your exceptions to inherit from a particular class that translates the exception into an HTTP response at runtime.

This introduces the problem that the correctness of my program depends on something else. It makes my program harder to test because I can't just rely on my inputs anymore. Furthermore, it makes my program less readable because in order to understand how my program behaves, I can't just look at the function itself but I need to consider the context in wich my function runs.

So how do we avoid this? How can we write our program so that we don't create side effects? How do we return different values depending on the result of the validation? How do we compose our functions so that we have one single flow independently of the result of the validation?

## Either Left or Right

The first step into our getting rid of side effects journey is to understand how we can rewrite our functions so that they don't throw exceptions. Let me show you how. The answer might be simpler than you expect.

Let's have a look at the following example.

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

What we need is to return something that can behave either as an `APIGatewayEvent` or as an `ApplicationError`. Read this 10 times.

In Functional Programming such a thing exists, and it takes the name of, unsurprisingly, __Either__[[4]](https://mostly-adequate.gitbooks.io/mostly-adequate-guide/ch08.html#pure-error-handling). 

`Either` can assume a `Left` value or a `Right` value. Conventionally the `Left` value represents an error state while  the `Right` value represent a successful computation.

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

If you ask a mathematician "I need to chain a series of functions together, but I also need to capture their errors" you would probably receive this answer: "Oh that's easy, just use a monad!". 

The answer is correct, unfortunately when I heard it for the first time it didn't really make sense to me. I'm going to summarise in a few words the way I think about monads hoping that it might help who, like me, comes to FP from imperative programming. This is an extreme semplification of the definition of a monad and I think FP purists will turn their noses up, but I think it's good enough if you want to start using monads in your application.

I see a monad as a container of one item. This container has three parts:
1. a type that describes the behavior of the container;
2. a constructor to be able build a container with an item in it;
3. one or more operations that allow you to combine (compose) monads. Each combinator allows you to generate a new monad from the item in it.

Each part also needs to respect a few mathematical laws. I won't go into more details. If you feel adventurous you can read all about monads in this [paper](http://bit.ly/monad-paper).

The constructor is generally called `of`. `A.of(val)` will build a monad of type `A` containing the value `val`. The most common combinators exposed by a monad are `map` and `chain`.

`map` takes a function as a parameter and returns a new monad containing the output of the function.

`chain`, also known as `flatMap`, is similar to `map` but expects the input function to return the new monad.

Good. So now what? How do we use this?

You will be glad to know that `Either` is a monad. And it is a monad that behaves in a particular way.

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

With `either.of(event)` we create a new `Either` monad containing the Api Gateway event. We then `chain` toghether each validation function. Remember every validation function returns an `Either`. 

When a new event goes through the chain each function will be applied as long as the previous functon returned a `Right`. If, for any reason, a validation rule fails, it will produce a `Left` value that will be propagated to the end of the chain. 

## IO
## Composing a Service 
## Running Locally