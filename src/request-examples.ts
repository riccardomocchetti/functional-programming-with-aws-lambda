import { APIGatewayEvent } from "aws-lambda";

export const exampleCreateEvent = {
  body: `{"user": "John", "title": "First Post", "text": "John's first post."}`,
  queryStringParameters: null,
  pathParameters: null,
  httpMethod: 'POST',
  path: '/userpost'
} as APIGatewayEvent;

export const exampleListEvent = {
  body: null,
  queryStringParameters: null,
  pathParameters: null,
  httpMethod: 'GET',
  path: '/userpost'
} as APIGatewayEvent;

export const exampleBadRequest = {
  body: null,
  queryStringParameters: null,
  pathParameters: null,
  httpMethod: 'POST',
  path: '/userpost'
} as APIGatewayEvent;
