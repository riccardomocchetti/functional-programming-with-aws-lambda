import { APIGatewayEvent } from 'aws-lambda';
import { exampleCreateEvent, exampleListEvent, exampleBadRequest } from './request-examples';
import { DB, createPostIO, listPostsIO } from './dao';
import { validateCreatePostEvent, validateListPostsEvent } from './validation';
import { HttpResponse, StatusCodes, ApplicationError } from './http';
import { taskEither } from 'fp-ts/lib/TaskEither';

const db = DB.inMemory();

const createPost = (event: APIGatewayEvent, database: DB = db) =>
  taskEither.of<ApplicationError, APIGatewayEvent>(event)
    .chain(validateCreatePostEvent)
    .chain(createPostIO(database))
    .fold(
      (error) => HttpResponse.fromError(error.statusCode, error),
      (result) => HttpResponse.fromResult(StatusCodes.CREATED, result)
    );

const listPosts = (event: APIGatewayEvent, database: DB = db) =>
  taskEither.of<ApplicationError, APIGatewayEvent>(event)
    .chain(validateListPostsEvent)
    .chain(listPostsIO(database))
    .fold(
      (error) => HttpResponse.fromError(error.statusCode, error),
      (result) => HttpResponse.fromResult(StatusCodes.OK, result)
    );

console.log('> Creating a post...');
createPost(exampleCreateEvent).map(console.log).run();

console.log('> Retrieving the list of posts...');
listPosts(exampleListEvent).map(console.log).run();

console.log('> Trying to send an invalid request...');
createPost(exampleBadRequest).map(console.log).run();
