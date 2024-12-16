# JavaScript Canvas Effects

This project showcases two different canvas-based visual effects implemented in JavaScript, leveraging the HTML5 Canvas API. It also uses some common web development technologies.

## Technologies Used

-   **HTML5 Canvas API:** Used for drawing graphics and animations on the fly.
-   **JavaScript:** The primary language for implementing the visual effects and manipulating the canvas.
-   **CSS:** Used for basic styling of the page and canvas elements.
-   **Navigo:** A client-side routing library used for navigation within the single-page application.
-   **Socket.IO:** A library for enabling real-time, bidirectional, and event-based communication between the client and server.
-   **Web3.js:** A library for interacting with the Ethereum blockchain.
-   **jdenticon:** A library for generating identicons based on a hash value.

## `lib/explode.js`

This file implements a particle explosion effect. When triggered (typically by a user interaction), it creates a burst of particles that expand outwards from a central point, simulating an explosion. The particles have randomized properties such as color, size, speed, and opacity, which fade over time. The effect is achieved by manipulating the canvas context using JavaScript.

## `lib/sheen.js`

This file implements a 3D rotating circle effect. It uses a basic 3D projection to render a circle that appears to rotate in 3D space. The circle's color and size are also affected by its depth in the 3D space, creating a sense of perspective. This effect is also achieved by manipulating the canvas context using JavaScript, along with some basic trigonometry for the 3D projection and rotation.

These effects are designed to be lightweight and easily integrated into web projects, demonstrating the power of the HTML5 Canvas API for creating dynamic visual elements.
