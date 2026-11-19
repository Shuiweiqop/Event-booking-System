<?php

use App\Exceptions\BookingException;
use App\Http\Middleware\EnsureUserIsAdmin;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Auth\AuthenticationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\ThrottleRequestsException;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\AccessDeniedHttpException;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias(['admin' => EnsureUserIsAdmin::class]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Every /api error uses the same { success: false, message, errors? } envelope.
        $exceptions->shouldRenderJsonWhen(fn (Request $request) => $request->is('api/*') || $request->expectsJson());

        $json = fn (string $message, int $status, array $extra = []) => response()->json(
            array_merge(['success' => false, 'message' => $message], $extra),
            $status
        );

        $exceptions->render(fn (BookingException $e) => $json($e->getMessage(), $e->status));

        $exceptions->render(function (ValidationException $e, Request $request) use ($json) {
            if ($request->is('api/*')) {
                return $json($e->validator->errors()->first(), 422, ['errors' => $e->errors()]);
            }
        });

        $exceptions->render(function (AuthenticationException $e, Request $request) use ($json) {
            if ($request->is('api/*')) {
                return $json('Unauthenticated. Please log in.', 401);
            }
        });

        $exceptions->render(function (AuthorizationException|AccessDeniedHttpException $e, Request $request) use ($json) {
            if ($request->is('api/*')) {
                return $json('You are not allowed to perform this action.', 403);
            }
        });

        $exceptions->render(function (ModelNotFoundException|NotFoundHttpException $e, Request $request) use ($json) {
            if ($request->is('api/*')) {
                return $json('Resource not found.', 404);
            }
        });

        $exceptions->render(function (ThrottleRequestsException $e, Request $request) use ($json) {
            if ($request->is('api/*')) {
                return $json('Too many requests. Please slow down and try again shortly.', 429);
            }
        });

        $exceptions->render(function (Throwable $e, Request $request) use ($json) {
            if ($request->is('api/*') && ! config('app.debug')) {
                $status = $e instanceof HttpExceptionInterface ? $e->getStatusCode() : 500;

                return $json($status === 500 ? 'Something went wrong. Please try again.' : $e->getMessage(), $status);
            }
        });
    })->create();
