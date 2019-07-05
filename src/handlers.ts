import { DB } from "./store";
import { APIGatewayEvent } from "aws-lambda";
import { listPosts, createPost } from "./service";

const db = DB.inMemory();

export const listPostsHandler = async (event: APIGatewayEvent) =>
  listPosts(event, db).run();

export const createPostHandler = async (event: APIGatewayEvent) =>
  createPost(event, db).run();
