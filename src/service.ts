import { APIGatewayEvent } from "aws-lambda";
import { DB } from "./store";
import { taskEither } from "fp-ts/lib/TaskEither";
import { ApplicationError, StatusCodes, errorResponse, successResponse } from "./http";
import { validateCreatePostEvent, validateListPostsEvent } from "./validation";
import { createPostIO, listPostsIO } from "./io";

export const createPost = (event: APIGatewayEvent, database: DB) =>
  taskEither.of<ApplicationError, APIGatewayEvent>(event)
    .chain(validateCreatePostEvent)
    .chain(createPostIO(database))
    .fold(
      errorResponse,
      successResponse(StatusCodes.CREATED)
    );

export const listPosts = (event: APIGatewayEvent, database: DB) =>
  taskEither.of<ApplicationError, APIGatewayEvent>(event)
    .chain(validateListPostsEvent)
    .chain(listPostsIO(database))
    .fold(
      errorResponse,
      successResponse(StatusCodes.OK)
    );
