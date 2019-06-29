import { UserPost, UserPostEvent } from "./model";
import { curry } from "fp-ts/lib/function";
import { ApplicationError, StatusCodes } from "./http";
import { tryCatch } from "fp-ts/lib/TaskEither";
import { APIGatewayEvent } from "aws-lambda";
import { DB } from "./store";

export const createPostIO = curry((database: DB, event: UserPostEvent) =>
  tryCatch<ApplicationError, UserPost>(
    () => database.createPost(event.body),
    reason => new ApplicationError(
      'Error storing item',
      [reason as string],
      StatusCodes.SERVER_ERROR)
  )
);

export const listPostsIO = curry((database: DB, event?: APIGatewayEvent) =>
  tryCatch<ApplicationError, UserPost[]>(
    () => database.listPosts(),
    reason => new ApplicationError(
      'Error retrieving list of items',
      [reason as string],
      StatusCodes.SERVER_ERROR)
  )
);
