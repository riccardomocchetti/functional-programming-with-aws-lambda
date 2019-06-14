import { APIGatewayEvent } from 'aws-lambda';
import { exampleCreateEvent, exampleListEvent, exampleBadRequest } from './request-examples';
import { DB } from './model';
import { validateCreatePostEvent, validateListPostsEvent } from './validation';
import { HttpResponse, StatusCodes } from './http';

const db = DB.inMemory();

const createPost = (event: APIGatewayEvent, database: DB = db) =>
  validateCreatePostEvent(event)
    .map((createPostEvent) => database.createPost(createPostEvent.body))
    .fold(
      (error) => HttpResponse.fromError(error.statusCode, error),
      (result) => HttpResponse.fromResult(StatusCodes.CREATED, result)
    );

const listPosts = (event: APIGatewayEvent, database: DB = db) =>
  validateListPostsEvent(event)
    .map(() => database.listPosts())
    .fold(
      (error) => HttpResponse.fromError(error.statusCode, error),
      (result) => HttpResponse.fromResult(StatusCodes.OK, result)
    );

console.log('> Creating a post...');
console.log(createPost(exampleCreateEvent));
console.log('> Retrieving the list of posts...');
console.log(listPosts(exampleListEvent));
console.log('> Trying to send an invalid request...');
console.log(createPost(exampleBadRequest));
