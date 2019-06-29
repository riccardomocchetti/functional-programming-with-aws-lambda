import { APIGatewayEvent } from "aws-lambda";
import { ApplicationError, StatusCodes } from './http';
import { UserPostEvent } from './model';
import { taskEither, left2v, right2v } from "fp-ts/lib/TaskEither";

const parseCreateEventBody = (event: APIGatewayEvent) => {
  if (event.body === null) {
    return left2v<ApplicationError, UserPostEvent>(
      new ApplicationError(
        'Error parsing request body',
        ['Body cannot be empty'],
        StatusCodes.BAD_REQUEST
      )
    );
  }
  try {
    const parsedBody = event.body !== null
      ? JSON.parse(event.body)
      : null;
    return right2v<ApplicationError, UserPostEvent>({
      ...event,
      body: parsedBody
    });
  } catch (error) {
    return left2v<ApplicationError, UserPostEvent>(
      new ApplicationError(
        'Error parsing request body',
        ['Invalid JSON'],
        StatusCodes.BAD_REQUEST
      )
    );
  }
};

const validateQueryParams = (event: APIGatewayEvent) => {
  if (event.queryStringParameters !== null) {
    return left2v<ApplicationError, APIGatewayEvent>(
      new ApplicationError(
        'Error parsing request query params',
        ['Query params should be empty'],
        StatusCodes.BAD_REQUEST
      )
    );
  }
  return right2v<ApplicationError, APIGatewayEvent>(event);
};

const validatePathParams = (event: APIGatewayEvent) => {
  if (event.pathParameters !== null) {
    return left2v<ApplicationError, APIGatewayEvent>(
      new ApplicationError(
        'Error parsing request path params',
        ['Path params should be empty'],
        StatusCodes.BAD_REQUEST
      )
    );
  }
  return right2v<ApplicationError, APIGatewayEvent>(event);
};

export const validateCreatePostEvent = (event: APIGatewayEvent) =>
  taskEither.of<ApplicationError, APIGatewayEvent>(event)
    .chain(validatePathParams)
    .chain(validateQueryParams)
    .chain(parseCreateEventBody);

export const validateListPostsEvent = (event: APIGatewayEvent) =>
  taskEither.of<ApplicationError, APIGatewayEvent>(event)
    .chain(validatePathParams)
    .chain(validateQueryParams);
