export function setupInput({ canvas, W, H, mouse, getGame, setState, pick, start, reset, tryJump, tryDash }) {
  const mp = (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) * W) / rect.width;
    mouse.y = ((event.clientY - rect.top) * H) / rect.height;
  };

  addEventListener("keydown", (event) => {
    const game = getGame();
    game.keys[event.code] = 1;
    if (
      ["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)
    ) {
      event.preventDefault();
    }

    if (game.state === "title") {
      const difficulty = {
        Digit1: "easy",
        Digit2: "normal",
        Digit3: "hard",
      }[event.code];
      if (difficulty) start(difficulty);
      return;
    }

    if (event.code === "Escape") {
      setState("title");
      return;
    }
    if (event.code === "KeyR") reset();
    if (event.repeat || game.state !== "play" || game.b.intro > 0) return;
    if (event.code === "KeyW" || event.code === "ArrowUp" || event.code === "Space") {
      tryJump();
    }
    if (event.code === "ShiftLeft" || event.code === "ShiftRight") {
      tryDash();
    }
  });

  addEventListener("keyup", (event) => {
    getGame().keys[event.code] = 0;
  });

  canvas.addEventListener("mousemove", mp);
  canvas.addEventListener("mousedown", (event) => {
    if (event.button !== 0) return;
    mp(event);
    mouse.down = true;
    const game = getGame();
    if (game.state === "title") {
      const selected = pick();
      if (selected) start(selected.k);
    } else if (game.state !== "play" && performance.now() - game.endT > 700) {
      reset();
    }
  });
  addEventListener("mouseup", (event) => {
    if (event.button === 0) mouse.down = false;
  });
  canvas.addEventListener("contextmenu", (event) => event.preventDefault());
}
