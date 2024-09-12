export const depthfrag =

`
#define PI 3.1415926535897932384626433832795
#include <packing>

varying vec2 texCoord;
uniform sampler2D depthTex;

float readDepth(sampler2D depthSampler, vec2 texCoord) {
    return texture2D(depthSampler, texCoord).x;
}

void main() {
    float depth = readDepth(depthTex, texCoord);
    if (depth < 0.995) {
        float x = pow(depth * PI, 2.5);
        gl_FragColor = vec4(cos(x), sin(x), -cos(x), 1.0);
        if (depth < 0.875)
            gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
    }
}
`;
