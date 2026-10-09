/* =========================================================
   ENERGY BACKGROUND
   The slow moving light behind the page (from the Stitch design).
   It's drawn by the GPU with WebGL, using a tiny program
   called a SHADER that runs once for every pixel.

   Any page can use it:
     <canvas class="energy-bg" id="energyBg" aria-hidden="true"></canvas>
     <script src="../js/effects/energy-bg.js"></script>
   ========================================================= */

// (function () { ... })() runs at once and keeps every name INSIDE it.
// So "canvas", "draw"... can't clash with names in the page's own script.
(function () {
    const canvas = document.getElementById("energyBg");
    if (!canvas) return;

    const gl = canvas.getContext("webgl");
    if (!gl) {                 // very old device: no WebGL → no background, the page still works
        canvas.remove();
        return;
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;


    /* ---------- 1. The two shader programs (written in GLSL, not JS) ---------- */

    // Vertex shader: places the 4 corners of one rectangle that covers the screen.
    // uv = where this pixel is: (0,0) bottom-left → (1,1) top-right.
    const VERTEX = `
        attribute vec2 position;
        varying vec2 uv;
        void main() {
            uv = position * 0.5 + 0.5;
            gl_Position = vec4(position, 0.0, 1.0);
        }
    `;

    // Fragment shader: decides the COLOR of every pixel, 60 times a second.
    const FRAGMENT = `
        precision mediump float;
        uniform float time;            // seconds since the page opened (sent from JS)
        varying vec2 uv;

        void main() {
            vec2 p = uv;
            float strength = 0.0;

            // 3 layers of waves bend the space a bit more each time.
            // Where x + y - 1 gets close to 0 (the diagonal through the MIDDLE),
            // 0.012 / (...) gets big → a bright band of light that drifts.
            for (float i = 1.0; i < 4.0; i++) {
                p.x += 0.08 / i * sin(i * 2.5 * p.y + time * 0.4);
                p.y += 0.08 / i * cos(i * 2.5 * p.x + time * 0.4);
                strength += abs(0.012 / (p.x + p.y - 1.0 + sin(time * 0.25) * 0.5));
            }

            vec3 color = vec3(0.06, 0.06, 0.07) + vec3(strength * 0.2);   // near-black + white light

            // Darker towards the edges, so the eye stays in the middle.
            float vignette = 1.0 - smoothstep(0.4, 1.4, length(uv - 0.5));

            gl_FragColor = vec4(color * vignette, 1.0);
        }
    `;

    // Turn shader text into a program the GPU can run.
    function compile(type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            console.warn("Energy background:", gl.getShaderInfoLog(shader));
            return null;
        }
        return shader;
    }

    const vertexShader = compile(gl.VERTEX_SHADER, VERTEX);
    const fragmentShader = compile(gl.FRAGMENT_SHADER, FRAGMENT);
    if (!vertexShader || !fragmentShader) {
        canvas.remove();
        return;
    }

    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.useProgram(program);


    /* ---------- 2. The rectangle that covers the screen ---------- */

    // 4 corners: bottom-left, bottom-right, top-left, top-right (-1 to 1 = the full screen).
    const corners = new Float32Array([-1, -1,  1, -1,  -1, 1,  1, 1]);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, corners, gl.STATIC_DRAW);

    const position = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);   // 2 numbers per corner

    const timeLocation = gl.getUniformLocation(program, "time");


    /* ---------- 3. Size: match the screen ---------- */

    // The canvas has a CSS size AND its own pixel size. They must match,
    // or the picture looks blurry. Max 1.5× on sharp phone screens, to save battery.
    function resize() {
        const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
        canvas.width = Math.round(window.innerWidth * ratio);
        canvas.height = Math.round(window.innerHeight * ratio);
        gl.viewport(0, 0, canvas.width, canvas.height);
        if (reduceMotion) draw(4000);          // still picture: draw it again at the new size
    }


    /* ---------- 4. Drawing ---------- */

    // requestAnimationFrame gives us the time in ms. The shader wants seconds.
    function draw(milliseconds) {
        gl.uniform1f(timeLocation, milliseconds / 1000);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);              // 4 corners → 1 rectangle
        if (!reduceMotion) requestAnimationFrame(draw);     // ask for the next frame
    }

    window.addEventListener("resize", resize);
    resize();                                          // reduced motion: this already drew the still frame
    if (!reduceMotion) requestAnimationFrame(draw);    // the browser pauses this by itself in hidden tabs
})();