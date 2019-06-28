import { UserPost, UserPostEvent } from "./model";
import { curry } from "fp-ts/lib/function";
import { ApplicationError } from "./http";
import { taskEither } from "fp-ts/lib/TaskEither";
import { APIGatewayEvent } from "aws-lambda";

export class DB {

    public static inMemory = () => new DB();
  
    private posts: UserPost[];
  
    private constructor() {
      this.posts = [];
    }
  
    public createPost = (post: UserPost) => {
      this.posts.push(post);
      return Promise.resolve(post);
    }
  
    public listPosts = () => Promise.resolve(this.posts);
}

export const createPostIO = curry((database: DB, event: UserPostEvent) =>
    taskEither.of<ApplicationError, UserPostEvent>(event)
        .map(postEvent => database.createPost(postEvent.body))
);

export const listPostsIO = curry((database: DB, event: APIGatewayEvent) =>
    taskEither.of<ApplicationError, APIGatewayEvent>(event)
        .map(_ => database.listPosts())
);
