import { DB } from "./store";
import { APIGatewayEvent } from "aws-lambda";
import { listPosts, createPost } from "./service";

const db = DB.inMemory();

export const listPostsHandler = (event: APIGatewayEvent) =>
  listPosts(event, db).run();

export const createPostHandler = (event: APIGatewayEvent) =>
  createPost(event, db).run();
