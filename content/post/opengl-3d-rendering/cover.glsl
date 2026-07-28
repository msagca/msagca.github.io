mat2 rot(float a) {
        float s = sin(a), c = cos(a);
        return mat2(c, -s, s, c);
}
float sdBox(vec3 p, vec3 b) {
        vec3 q = abs(p) - b;
        return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}
float map(vec3 p) {
        p.xz *= rot(iTime * 0.6);
        p.xy *= rot(iTime * 0.4);
        return sdBox(p, vec3(0.5));
}
vec3 calcNormal(vec3 p) {
        vec2 e = vec2(1e-3, 0.0);
        return normalize(vec3(map(p + e.xyy) - map(p - e.xyy), map(p + e.yxy) - map(p - e.yxy), map(p + e.yyx) - map(p - e.yyx)));
}
void mainImage(out vec4 fragColor, in vec2 fragCoord) {
        vec2 uv = (fragCoord - 0.5 * iResolution.xy) / iResolution.y;
        vec3 ro = vec3(0.0, 0.0, -3.0);
        vec3 rd = normalize(vec3(uv, 1.5));
        float t = 0.0;
        bool hit = false;
        vec3 p = ro;
        for (int i = 0; i < 80; i++) {
                p = ro + rd * t;
                float d = map(p);
                if (d < 0.001) {
                        hit = true;
                        break;
                }
                t += d;
                if (t > 20.0) break;
        }
        vec3 col = vec3(0.02, 0.02, 0.05);
        if (hit) {
                vec3 n = calcNormal(p);
                vec3 lightDir = normalize(vec3(0.6, 0.7, -0.5));
                float diff = max(dot(n, lightDir), 0.0);
                float ambient = 0.15;
                vec3 baseColor = vec3(0.9, 0.35, 0.2);
                col = baseColor * (diff * 0.85 + ambient);
                float rim = pow(1.0 - max(dot(n, -rd), 0.0), 2.0);
                col += rim * 0.2;
        }
        col = pow(col, vec3(0.4545));
        fragColor = vec4(col, 1.0);
}
