<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Route;
use Symfony\Component\Yaml\Yaml;
use Tests\TestCase;

/**
 * Keeps docs/openapi.yaml honest: every API route must be documented and every
 * documented operation must exist — so the docs can't silently drift from the code.
 */
class ApiDocumentationTest extends TestCase
{
    private const UNDOCUMENTED = ['api/docs', 'api/openapi.yaml']; // the docs themselves

    private function spec(): array
    {
        return Yaml::parseFile(base_path('docs/openapi.yaml'));
    }

    /** @return list<string> e.g. "post /registrations/{id}/cancel" */
    private function routeOperations(): array
    {
        return collect(Route::getRoutes()->getRoutes())
            ->filter(fn ($r) => str_starts_with($r->uri(), 'api/') && ! in_array($r->uri(), self::UNDOCUMENTED, true))
            ->flatMap(fn ($r) => collect($r->methods())
                ->reject(fn ($m) => $m === 'HEAD')
                ->map(fn ($m) => strtolower($m).' '.substr($r->uri(), 3)))
            ->sort()->values()->all();
    }

    /** @return list<string> */
    private function specOperations(): array
    {
        return collect($this->spec()['paths'])
            ->flatMap(fn ($ops, $path) => collect(array_keys($ops))
                ->intersect(['get', 'post', 'put', 'patch', 'delete'])
                ->map(fn ($m) => "{$m} {$path}"))
            ->sort()->values()->all();
    }

    public function test_spec_is_valid_yaml_with_openapi_3(): void
    {
        $spec = $this->spec();

        $this->assertStringStartsWith('3.', $spec['openapi']);
        $this->assertNotEmpty($spec['info']['title']);
    }

    public function test_every_api_route_is_documented(): void
    {
        $missing = array_diff($this->routeOperations(), $this->specOperations());

        $this->assertSame([], array_values($missing), 'Routes missing from docs/openapi.yaml');
    }

    public function test_every_documented_operation_exists(): void
    {
        $stale = array_diff($this->specOperations(), $this->routeOperations());

        $this->assertSame([], array_values($stale), 'Documented operations with no matching route');
    }

    public function test_every_ref_points_to_an_existing_component(): void
    {
        $spec = $this->spec();
        preg_match_all("/\\\$ref: '#\\/components\\/(\\w+)\\/(\\w+)'/", file_get_contents(base_path('docs/openapi.yaml')), $m, PREG_SET_ORDER);

        $this->assertNotEmpty($m);
        foreach ($m as [, $section, $name]) {
            $this->assertArrayHasKey($name, $spec['components'][$section] ?? [], "Broken \$ref: #/components/{$section}/{$name}");
        }
    }

    public function test_admin_operations_declare_bearer_auth(): void
    {
        foreach ($this->spec()['paths'] as $path => $ops) {
            if (! str_starts_with($path, '/admin/') || $path === '/admin/login') {
                continue;
            }
            foreach ($ops as $method => $op) {
                $this->assertSame([['bearerAuth' => []]], $op['security'] ?? null, "{$method} {$path} should require bearerAuth");
            }
        }
    }

    public function test_docs_page_and_spec_are_served(): void
    {
        $this->get('/api/openapi.yaml')
            ->assertOk()
            ->assertHeader('Content-Type', 'application/yaml; charset=utf-8')
            ->assertSee('openapi: 3.0.3', false);

        $this->get('/api/docs')
            ->assertOk()
            ->assertSee('swagger-ui', false)
            ->assertSee('"openapi.yaml"', false);
    }
}
