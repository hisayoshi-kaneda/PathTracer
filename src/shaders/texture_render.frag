#version 330
precision highp float;

in vec3 f_posTexture;

out vec4 out_color;

uniform sampler2D texImage;
float gamma = 2.2;

vec3 gammaCorrection(vec3 color){
    return pow(color, vec3(1.0/gamma));
}

void main(void){
    vec3 gc = vec3(texelFetch(texImage, ivec2(gl_FragCoord.xy), 0));
    out_color = vec4(gammaCorrection(gc), 1.0);
}
