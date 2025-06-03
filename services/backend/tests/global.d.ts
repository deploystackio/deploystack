import { FastifyInstance } from 'fastify';

declare global {
  var __TEST_SERVER__: FastifyInstance;
  var __TEST_PORT__: number;
  var __FIRST_USER_ID__: string;
  var __FIRST_USER_COOKIE__: string;
  var __SECOND_USER_ID__: string;
  var __SECOND_USER_COOKIE__: string;
  var __FIRST_USER_LOGIN_COOKIE__: string;
  var __SECOND_USER_LOGIN_COOKIE__: string;
}

// This export ensures the file is treated as a module,
// and 'declare global' correctly augments the global scope.
export {};
