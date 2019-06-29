import { APIGatewayEvent } from "aws-lambda";
import { ApplicationError, StatusCodes } from './http';
import { UserPostEvent } from './model';
import {
  taskEither as either,
  left2v as left,
  right2v as right
} from "fp-ts/lib/TaskEither";

const bodyNotNull = (event: APIGatewayEvent) => {
  if (event.body === null) {
    return left<ApplicationError, APIGatewayEvent>(
      new ApplicationError(
        'Error parsing request body',
        ['Body cannot be empty'],
        StatusCodes.BAD_REQUEST
      )
    );
  }
  return right<ApplicationError, APIGatewayEvent>(event);
};

const parseCreateEventBody = (event: APIGatewayEvent) => {
  try {
    const parsedBody = event.body
      ? JSON.parse(event.body)
      : {};
    return right<ApplicationError, UserPostEvent>({
      ...event,
      body: parsedBody
    });
  } catch (error) {
    return left<ApplicationError, UserPostEvent>(
      new ApplicationError(
        'Error parsing request body',
        ['Invalid JSON'],
        StatusCodes.BAD_REQUEST
      )
    );
  }
};

const queryParamsNotNull = (event: APIGatewayEvent) => {
  if (event.queryStringParameters !== null) {
    return left<ApplicationError, APIGatewayEvent>(
      new ApplicationError(
        'Error parsing request query params',
        ['Query params should be empty'],
        StatusCodes.BAD_REQUEST
      )
    );
  }
  return right<ApplicationError, APIGatewayEvent>(event);
};

const pathParamsNotNull = (event: APIGatewayEvent) => {
  if (event.pathParameters !== null) {
    return left<ApplicationError, APIGatewayEvent>(
      new ApplicationError(
        'Error parsing request path params',
        ['Path params should be empty'],
        StatusCodes.BAD_REQUEST
      )
    );
  }
  return right<ApplicationError, APIGatewayEvent>(event);
};

export const validateCreatePostEvent = (event: APIGatewayEvent) =>
  either.of<ApplicationError, APIGatewayEvent>(event)
    .chain(validateListPostsEvent)
    .chain(bodyNotNull)
    .chain(parseCreateEventBody);

export const validateListPostsEvent = (event: APIGatewayEvent) =>
  either.of<ApplicationError, APIGatewayEvent>(event)
    .chain(pathParamsNotNull)
    .chain(queryParamsNotNull);
