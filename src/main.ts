import { APIGatewayEvent } from 'aws-lambda';
import { fromNullable, fromPredicate, tryCatch2v } from 'fp-ts/lib/Either';

interface Headers {
  [key: string]: string;
}

const DEFAULT_HEADERS = {
  'Content-Type': 'application/json'
};

class HttpResponse<T> {

  public static fromResult<T>(statusCode: StatusCodes, result: T, headers: Headers = DEFAULT_HEADERS) {
    return new HttpResponse<T>(
      statusCode,
      headers,
      JSON.stringify(result)
    );
  }

  public static fromError(statusCode: StatusCodes, error: ApplicationError, headers: Headers = DEFAULT_HEADERS) {
    return new HttpResponse(
      statusCode,
      headers,
      JSON.stringify({ message: error.message, errors: error.errors })
    );
  }

  public readonly statusCode: StatusCodes;
  public readonly headers: Headers;
  public readonly body: string;

  private constructor(statusCode: StatusCodes, headers: Headers, body: string) {
    this.statusCode = statusCode;
    this.headers = headers;
    this.body = body;
  }
}

class DB {
  private posts: UserPost[];

  public constructor() {
    this.posts = [];
  }

  public createPost = (post: UserPost) => {
    this.posts.push(post);

    return post;
  }

  public listPosts = () => this.posts;
}

class StatusCodes {
  public static readonly OK = 200;
  public static readonly CREATED = 201;
  public static readonly BAD_REQUEST = 400;
}

class ApplicationError {
  public readonly message: string;
  public readonly errors: string[];
  public readonly statusCode: StatusCodes;

  public constructor(message: string, errors: string[], status: StatusCodes) {
    this.message = message;
    this.errors = errors;
    this.statusCode = status;
  }
}

interface UserPost {
  user: string;
  title: string;
  text: string;
}

interface UserPostEvent {
  pathParameters: { [name: string]: string } | null;
  queryStringParameters: { [name: string]: string } | null;
  body: UserPost | null;
}

const exampleCreateEvent = {
  body: `{"user": "John", "title": "First Post", "text": "John's first post."}`,
  queryStringParameters: null,
  pathParameters: null,
  httpMethod: 'POST',
  path: '/userpost'
} as APIGatewayEvent;

const exampleListEvent = {
  body: null,
  queryStringParameters: null,
  pathParameters: null,
  httpMethod: 'GET',
  path: '/userpost'
} as APIGatewayEvent;

const exampleBadRequest = {
  body: null,
  queryStringParameters: null,
  pathParameters: null,
  httpMethod: 'GET',
  path: '/userpost'
} as unknown as APIGatewayEvent;

const parseCreateEventBody = (event: APIGatewayEvent) =>
  tryCatch2v<ApplicationError, UserPostEvent>(
    () => {
      const parsedBody = event.body !== null
        ? JSON.parse(event.body)
        : null;

      return { ...event, body: parsedBody };
    },
    () => new ApplicationError(
      'Error parsing request body',
      ['Invalid JSON'],
      StatusCodes.BAD_REQUEST
    )
  );

const validateBodyNotNull = (createEvent: UserPostEvent) =>
  fromNullable(new ApplicationError(
    'Error parsing request body',
    ['Body cannot be empty'],
    StatusCodes.BAD_REQUEST)
  )(createEvent.body)
  .map((body) => ({
    ...createEvent,
    body
  }));

const validateQueryParams = (event: APIGatewayEvent) =>
  fromPredicate(
    (params) => params === null,
    () => new ApplicationError(
      'Error parsing request query params',
      ['Query params should be empty'],
      StatusCodes.BAD_REQUEST
    )
  )(event.queryStringParameters);

const validatePathParams = (event: APIGatewayEvent) =>
  fromPredicate(
    (params) => params === null,
    () => new ApplicationError(
      'Error parsing request path params',
      ['Path params should be empty'],
      StatusCodes.BAD_REQUEST
    )
  )(event.pathParameters);

const validateCreatePostEvent = (event: APIGatewayEvent) =>
  validatePathParams(event)
    .chain(() => validateQueryParams(event))
    .chain(() => parseCreateEventBody(event))
    .chain((createEvent) => validateBodyNotNull(createEvent));

const validateListPostsEvent = (event: APIGatewayEvent) =>
  validatePathParams(event)
    .chain(() => validateQueryParams(event));

const db = new DB();

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
