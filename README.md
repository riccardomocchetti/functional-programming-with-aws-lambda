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

What I would like to show to the reader in the next sections is that to actually benefit from functional programming, we need to change how we think and write code.
I would like to describe what my thought process is like when I write a program, and that by applying a few principles we can actually see the benefits of functional programming.


## Why AWS Lambda
AWS Lambda is a fully managed environment where we can run our code (with some limits). 

The model is really simple. The code is deployed in what it's called a lambda function. Whenever your the lambda function receives an event (from one of the supported AWS services), it then triggers the code deployed passing the event received as a parameter.

It sounds perfect! Functional programming is all about defining your program as functions, so AWS Lambda gives us the right abstraction to interact with other AWS services. Everithing is an event that we receive as a parameter.

One of the most common usage of AWS Lambda is in conjuntion with AWS API Gateway to build a REST application. The API Gateway deals with receiving, parsing and potentially validating a requests. The request is passed to a lambda function as an event, and triggers its execution.

We can already see an advantage of using this model when we develop our REST application. The logic for receiving and parsing an HTTP request is already implemented, we don't have to think about it. All we are interested in is our event input and the business logic we need to implement.

This can also be extended to other AWS services, for example AWS SQS or AWS SNS where we don't have to implement the logic for retrieving messages from the queue/topic, and so on.

## A Real Example
Enough with the chit-chat, let's focus on a _real_ application and let's see what it means to write it in functional programming and run it in AWS Lambda.

This application is a really simple one, the backend for a blog. It offers a REST API that allows two operations:

- __POST__ _/posts_ to create a blog post;
- __GET__ _/posts_ to retrieve the full list of posts.

This [repository]() contains all the code snippets I show in the next sections and can be run as a standalone application.

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

> Function composition is the process of applying a function to the output of another function [[2]](https://medium.com/@gigobyte/implementing-the-function-composition-operator-in-javascript-e2c4f1847d6a)



## FP patterns
### Composition
### Railway oriented programming
### IO

## Request validation

## Database interaction

## Composing the service