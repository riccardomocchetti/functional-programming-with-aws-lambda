import { APIGatewayEvent } from "aws-lambda";
import { Either, right, left, either } from 'fp-ts/lib/Either';
import { ApplicationError, StatusCodes } from './http';
import { UserPostEvent } from './model';

const parseCreateEventBody = (event: APIGatewayEvent): Either<ApplicationError, UserPostEvent> => {
  if (event.body === null) {
    return left(
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
    return right({ ...event, body: parsedBody });
  } catch (error) {
    return left(
      new ApplicationError(
        'Error parsing request body',
        ['Invalid JSON'],
        StatusCodes.BAD_REQUEST
      )
    );
  }
};

const validateQueryParams = (event: APIGatewayEvent): Either<ApplicationError, APIGatewayEvent> => {
  if (event.queryStringParameters !== null) {
    return left(
      new ApplicationError(
        'Error parsing request query params',
        ['Query params should be empty'],
        StatusCodes.BAD_REQUEST
      )
    );
  }
  return right(event);
};

const validatePathParams = (event: APIGatewayEvent): Either<ApplicationError, APIGatewayEvent> => {
  if (event.pathParameters !== null) {
    return left(
      new ApplicationError(
        'Error parsing request path params',
        ['Path params should be empty'],
        StatusCodes.BAD_REQUEST
      )
    );
  }
  return right(event);
};

export const validateCreatePostEvent = (event: APIGatewayEvent): Either<ApplicationError, UserPostEvent> =>
  either.of<ApplicationError, APIGatewayEvent>(event)
    .chain(validatePathParams)
    .chain(validateQueryParams)
    .chain(parseCreateEventBody);

export const validateListPostsEvent = (event: APIGatewayEvent): Either<ApplicationError, APIGatewayEvent> =>
  either.of<ApplicationError, APIGatewayEvent>(event)
    .chain(validatePathParams)
    .chain(validateQueryParams);
