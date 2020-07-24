#version 410
precision highp float;
#define EPS 1e-2
#define INF 1e10
#define DIFFUSE 0
#define SPECULAR 1
#define REFRACTION 2
#define DEPTH_MAX 100
#define DEPTH_MIN 30

const float PI = acos(-1.0);
const uint UINT_MAX = 4294967295U;

uniform vec2 resolution;
uniform vec2 mouse;
uniform int frame;
uniform int numSamples;
uniform vec2 u_seed;

out vec4 out_color;

float pixSize = 1.0;

struct Sphere {
    float radius;
    vec3 center;
    vec3 color;
    vec3 emission;
    int reflectType;
};

struct Scene{
    Sphere s[10];
};

struct Ray{
    vec3 org;
    vec3 dir;
};

struct Hitpoint{
    vec3 pos;
    vec3 normal;
    float dist;
    int objectId;
};

vec2 randState;
float rand() {
    float a = 12.9898;
    float b = 78.233;
    float c = 43758.5453;
    randState.x = fract(sin(float(dot(randState.xy - u_seed, vec2(a, b)))) * c);
    randState.y = fract(sin(float(dot(randState.xy - u_seed, vec2(a, b)))) * c);
    return randState.x;
}

bool intersectSphere(Ray r, Sphere s, inout Hitpoint hp){
    float b = dot(r.dir, r.org - s.center);
    float c = dot(r.org - s.center, r.org - s.center) - s.radius * s.radius;
    float D = b * b - c;
    if (D < 0.0){
        return false;
    }
    float sD = sqrt(D);
    float t1, t2;
    if (b > 0.0){
        t1 = float(-b -sD);
        t2 = float(c) / t1;
    } else {
        t2 = float(-b + sD);
        t1 = float(c) / t2;
    }
    if (t1 < EPS && t2 < EPS) return false;
    if (t1 > EPS){
        hp.dist = float(t1);
    }
    else {
        hp.dist = float(t2);
    }
    hp.pos = r.org + hp.dist * r.dir;
    hp.normal = normalize(hp.pos - s.center);
    return true;
}

bool intersectScene(Ray r, Scene scene, inout Hitpoint hp){
    hp.dist = INF;
    hp.objectId = -1;
    for (int i = 0;i < 10; i++){
        Hitpoint tmp;
        tmp.objectId = i;
        if (intersectSphere(r, scene.s[i], tmp)){
            if (tmp.dist < hp.dist){
                hp.pos = tmp.pos;
                hp.normal = tmp.normal;
                hp.dist = tmp.dist;
                hp.objectId = tmp.objectId;
            }
        }
    }
    return (hp.objectId != -1);
}

vec3 radiance(Ray ray, Scene scene){
    vec3 accumulatedColor = vec3(0.0);
    vec3 accumulatedReflectance = vec3(1.0);
    int depth = 0;
    Ray nowRay = ray;
    for (;;depth++){
        Hitpoint hp;
        if (!intersectScene(nowRay, scene, hp)){
            return accumulatedColor;
        }
        Sphere obj = scene.s[hp.objectId];
        vec3 orientingNormal = (dot(hp.normal, nowRay.dir) < 0.0 ? hp.normal: (-1.0 * hp.normal));
        accumulatedColor += accumulatedReflectance * obj.emission;

        float rrp = max(obj.color.x, max(obj.color.y, obj.color.z));//roussian roulette probability
        if (depth > DEPTH_MAX){
            rrp *= pow(0.5, float(depth - DEPTH_MAX));
        }

        if (depth > DEPTH_MIN){
            float rnd = rand();
            if (rnd >= rrp){
                return accumulatedColor;
            }
        } else {
            rrp = 1.0;
        }
        switch (obj.reflectType){
            case DIFFUSE: {
                vec3 w, u, v;
                w = orientingNormal;
                if (abs(w.x) > 0.1) u = normalize(cross(vec3(0.0, 1.0, 0.0), w));
                else u = normalize(cross(vec3(1.0, 0.0, 0.0), w));
                v = normalize(cross(w, u));
                float r1 = 2.0 * PI * rand();
                float r2 = rand();
                float r2s = sqrt(r2);
                vec3 dir = normalize(u * cos(r1) * r2s + v * sin(r1) * r2s + w * sqrt(1.0 - r2));
                nowRay = Ray(hp.pos + dir * EPS * 10.0, dir);
                accumulatedReflectance *= obj.color / rrp;
            }break;

            case SPECULAR:{
                vec3 dir =  nowRay.dir - hp.normal * 2.0 * dot(hp.normal, nowRay.dir);
                nowRay = Ray(hp.pos + dir * EPS * 10.0, dir);
                accumulatedReflectance = accumulatedReflectance * obj.color / rrp;
            }break;
        }
        continue;
    }
    return accumulatedColor;
}

void main(){
    randState = gl_FragCoord.xy / vec2(640, 480);
    Scene scene;
    scene.s[0] = Sphere(1e4, vec3(1e4+1.0, 40.8, 81.6), vec3(0.75, 0.25, 0.25), vec3(0.0), DIFFUSE);
    scene.s[1] = Sphere(1e4, vec3(-1e4+99.0, 40.8, 81.6), vec3(0.25, 0.25, 0.75), vec3(0.0), DIFFUSE);
    scene.s[2] = Sphere(1e4, vec3(50, 40.8, 1e4), vec3(0.75, 0.75, 0.75), vec3(0.0), DIFFUSE);
    scene.s[3] = Sphere(1e4, vec3(50, 40.8, -1e4+250.0), vec3(0.0), vec3(0.0), DIFFUSE);
    scene.s[4] = Sphere(1e4, vec3(50, 1e4, 81.6), vec3(0.75, 0.75, 0.75), vec3(0.0), DIFFUSE);
    scene.s[5] = Sphere(1e4, vec3(50, -1e4+81.6, 81.6), vec3(0.75, 0.75, 0.75), vec3(0.0), DIFFUSE);
    scene.s[6] = Sphere(15.0, vec3(50.0, 90.0, 81.6), vec3(0.0), vec3(36.0, 36.0, 36.0), DIFFUSE);
    scene.s[7] = Sphere(20.0, vec3(65.0, 20.0, 20.0), vec3(0.25, 0.75, 0.25), vec3(0.0), DIFFUSE);
    scene.s[8] = Sphere(16.5, vec3(27.0, 16.5, 47.0), vec3(0.99, 0.99, 0.99), vec3(0.0), SPECULAR),
    scene.s[9] = Sphere(16.5, vec3(77.0, 16.5, 78.0), vec3(0.99, 0.99, 0.99), vec3(0.0), SPECULAR);
    const vec3 cameraPosition = vec3(50.0, 52.0, 220.0);
    const vec3 cameraDir      = normalize(vec3(0.0, -0.04, -1.0));
    const vec3 cameraUp = vec3(0.0, 1.0, 0.0);
    float screenDist = 40.0;
    float screenHeight = 30.0;
    float screenWidth = screenHeight * resolution.x / resolution.y;
    vec3 screenX = normalize(cross(cameraDir, cameraUp));
    vec3 screenY = normalize(cross(screenX, cameraDir));
    vec3 screenCenter = cameraPosition + cameraDir * screenDist;
    float pixSize = screenHeight / resolution.y;
    vec3 pixPos = screenX * (gl_FragCoord.x / resolution.x - 0.5) * screenWidth + screenY * (gl_FragCoord.y / resolution.y - 0.5) * screenHeight + screenCenter;
    vec3 sumRadiance = vec3(0.0);
    int n = 1;
    for (int i=0;i < n;i++){
        vec3 pos = pixPos + pixSize / 2.0 * (screenX + screenY);
        Ray ray = Ray(cameraPosition, normalize(pos - cameraPosition));
        sumRadiance += radiance(ray, scene) / float(numSamples);
    }
    out_color = vec4(sumRadiance, 1.0);
    return;
}
