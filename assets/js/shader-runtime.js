(function () {
  "use strict";
  var embeds = document.querySelectorAll(".shader-embed");
  if (!embeds.length) return;
  var VERT_SRC =
    "attribute vec2 aPos;" +
    "void main() { gl_Position = vec4(aPos, 0.0, 1.0); }";
  var FRAG_HEADER =
    "precision highp float;" +
    "uniform float iTime;" +
    "uniform vec3 iResolution;" +
    "uniform vec4 iMouse;";
  var FRAG_FOOTER = "void main() { mainImage(gl_FragColor, gl_FragCoord.xy); }";
  embeds.forEach(function (embed) {
    var canvas = embed.querySelector(".shader-canvas");
    var errorEl = embed.querySelector(".shader-error");
    var scriptEl = embed.querySelector('script[type="x-shader/x-fragment"]');
    if (!canvas || !scriptEl) return;
    var userSrc = scriptEl.textContent;
    var gl =
      canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) {
      showError("WebGL is not available in this browser.");
      return;
    }
    function showError(msg) {
      canvas.hidden = true;
      errorEl.hidden = false;
      errorEl.textContent = msg;
    }
    function compile(type, src) {
      var shader = gl.createShader(type);
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        var log = gl.getShaderInfoLog(shader);
        gl.deleteShader(shader);
        throw new Error(log);
      }
      return shader;
    }
    var program;
    try {
      var vs = compile(gl.VERTEX_SHADER, VERT_SRC);
      var fs = compile(gl.FRAGMENT_SHADER, FRAG_HEADER + userSrc + FRAG_FOOTER);
      program = gl.createProgram();
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        throw new Error(gl.getProgramInfoLog(program));
      }
    } catch (err) {
      showError("Shader compile error: " + err.message);
      return;
    }
    gl.useProgram(program);
    var quad = new Float32Array([-1, -1, 3, -1, -1, 3]);
    var buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, quad, gl.STATIC_DRAW);
    var aPos = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    var uTime = gl.getUniformLocation(program, "iTime");
    var uResolution = gl.getUniformLocation(program, "iResolution");
    var uMouse = gl.getUniformLocation(program, "iMouse");
    var mouse = [0, 0, 0, 0];
    canvas.addEventListener("pointermove", function (e) {
      var rect = canvas.getBoundingClientRect();
      mouse[0] = e.clientX - rect.left;
      mouse[1] = rect.height - (e.clientY - rect.top);
    });
    canvas.addEventListener("pointerdown", function () {
      mouse[2] = 1;
    });
    window.addEventListener("pointerup", function () {
      mouse[2] = 0;
    });
    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      var w = Math.round(canvas.clientWidth * dpr);
      var h = Math.round(canvas.clientHeight * dpr);
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
    }
    var visible = true;
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
      });
      io.observe(canvas);
    }
    var start = performance.now();
    var frame;
    function tick(now) {
      frame = requestAnimationFrame(tick);
      if (!visible) return;
      resize();
      gl.uniform1f(uTime, (now - start) / 1000);
      gl.uniform3f(uResolution, canvas.width, canvas.height, 1);
      gl.uniform4f(uMouse, mouse[0], mouse[1], mouse[2], mouse[3]);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }
    frame = requestAnimationFrame(tick);
  });
})();
