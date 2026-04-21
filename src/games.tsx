import React, { useState, useEffect } from "react";

// ========== SNAKE GAME ==========
export function SnakeGame({ onComplete }: { onComplete: () => void }) {
  const GRID_SIZE = 10;
  const [snake, setSnake] = useState<[number, number][]>([[5, 5]]);
  const [food, setFood] = useState<[number, number]>([7, 7]);
  const [direction, setDirection] = useState<[number, number]>([1, 0]);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" && direction[0] === 0) setDirection([1, 0]);
      if (e.key === "ArrowLeft" && direction[0] === 0) setDirection([-1, 0]);
      if (e.key === "ArrowUp" && direction[1] === 0) setDirection([0, -1]);
      if (e.key === "ArrowDown" && direction[1] === 0) setDirection([0, 1]);
    };
    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [direction]);

  useEffect(() => {
    if (gameOver) return;
    const interval = setInterval(() => {
      setSnake((prevSnake) => {
        const head = prevSnake[0];
        const newHead: [number, number] = [
          (head[0] + direction[0] + GRID_SIZE) % GRID_SIZE,
          (head[1] + direction[1] + GRID_SIZE) % GRID_SIZE
        ];

        if (prevSnake.some((seg) => seg[0] === newHead[0] && seg[1] === newHead[1])) {
          setGameOver(true);
          return prevSnake;
        }

        let newSnake = [newHead, ...prevSnake];
        if (newHead[0] === food[0] && newHead[1] === food[1]) {
          setScore((s) => s + 10);
          setFood([Math.floor(Math.random() * GRID_SIZE), Math.floor(Math.random() * GRID_SIZE)]);
        } else {
          newSnake.pop();
        }
        return newSnake;
      });
    }, 150);
    return () => clearInterval(interval);
  }, [direction, food, gameOver]);

  return (
    <div className="game-container">
      <div className="game-title">🐍 SNAKE GAME 🐍</div>
      <div className="snake-grid">
        {Array.from({ length: GRID_SIZE }).map((_, y) =>
          Array.from({ length: GRID_SIZE }).map((_, x) => {
            const isSnake = snake.some((seg) => seg[0] === x && seg[1] === y);
            const isHead = snake[0][0] === x && snake[0][1] === y;
            const isFood = food[0] === x && food[1] === y;
            return (
              <div
                key={`${x}-${y}`}
                className={`snake-cell ${isSnake ? "snake" : ""} ${isHead ? "head" : ""} ${
                  isFood ? "food" : ""
                }`}
              />
            );
          })
        )}
      </div>
      <div className="game-info">Score: {score}</div>
      {gameOver && (
        <div className="game-over-modal">
          <div>GAME OVER! Score: {score}</div>
          <button onClick={onComplete} className="game-button">
            Continue →
          </button>
        </div>
      )}
    </div>
  );
}

// ========== MOST CLICKS GAME ==========
export function MostClicksGame({ onComplete }: { onComplete: () => void }) {
  const [clicks, setClicks] = useState(0);
  const [timeLeft, setTimeLeft] = useState(10);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft((t) => t - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft]);

  if (timeLeft <= 0) {
    return (
      <div className="game-container">
        <div className="game-title">⚡ MOST CLICKS ⚡</div>
        <div className="game-result">
          <div>You clicked {clicks} times!</div>
          <button onClick={onComplete} className="game-button">
            Next Level →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="game-container">
      <div className="game-title">⚡ CLICK IT LIKE YOU MEAN IT ⚡</div>
      <div className="game-timer">Time: {timeLeft}s</div>
      <button
        className="mega-click-btn"
        onClick={() => setClicks((c) => c + 1)}
      >
        CLICK ME!
      </button>
      <div className="game-score">Clicks: {clicks}</div>
    </div>
  );
}

// ========== FALLING BLOCKS GAME ==========
export function RandomFallGame({ onComplete }: { onComplete: () => void }) {
  const [caught, setCaught] = useState(0);
  const [blocks, setBlocks] = useState<{ id: number; x: number; y: number }[]>([]);
  const [playerPos, setPlayerPos] = useState(45);
  const [nextId, setNextId] = useState(0);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const containerWidth = 400;
      const x = (e.clientX % containerWidth) - 20;
      setPlayerPos(Math.max(0, Math.min(x, containerWidth - 40)));
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  useEffect(() => {
    const spawnInterval = setInterval(() => {
      setBlocks((prev) => [...prev, { id: nextId, x: Math.random() * 360, y: 0 }]);
      setNextId((n) => n + 1);
    }, 500);
    return () => clearInterval(spawnInterval);
  }, [nextId]);

  useEffect(() => {
    const moveInterval = setInterval(() => {
      setBlocks((prev) => {
        return prev
          .map((block) => ({ ...block, y: block.y + 10 }))
          .filter((block) => {
            if (block.y > 380 && block.x > playerPos && block.x < playerPos + 40) {
              setCaught((c) => c + 1);
              return false;
            }
            return block.y < 400;
          });
      });
    }, 50);
    return () => clearInterval(moveInterval);
  }, [playerPos]);

  return (
    <div className="game-container">
      <div className="game-title">🎮 CATCH THE BLOCKS 🎮</div>
      <div className="fall-game-area">
        {blocks.map((block) => (
          <div
            key={block.id}
            className="falling-block"
            style={{ left: `${block.x}px`, top: `${block.y}px` }}
          />
        ))}
        <div className="player-paddle" style={{ left: `${playerPos}px` }} />
      </div>
      <div className="game-score">Caught: {caught}/10</div>
      {caught >= 10 && (
        <div className="game-over-modal">
          <div>WINNER! Caught {caught} blocks!</div>
          <button onClick={onComplete} className="game-button">
            Next Level →
          </button>
        </div>
      )}
    </div>
  );
}

// ========== TOSSING GAME ==========
export function TossingGame({ onComplete }: { onComplete: () => void }) {
  const [score, setScore] = useState(0);
  const [targets, setTargets] = useState(
    Array.from({ length: 5 }, (_, i) => ({
      id: i,
      x: Math.random() * 320,
      y: 50 + i * 60,
      hit: false
    }))
  );

  const handleToss = (id: number) => {
    setTargets((prev) =>
      prev.map((t) => (t.id === id ? { ...t, hit: true } : t))
    );
    setScore((s) => s + 10);
  };

  const allHit = targets.every((t) => t.hit);

  return (
    <div className="game-container">
      <div className="game-title">🎯 BEAN TOSS 🎯</div>
      <div className="toss-game-area">
        {targets.map((target) => (
          <button
            key={target.id}
            className={`toss-target ${target.hit ? "hit" : ""}`}
            style={{ left: `${target.x}px`, top: `${target.y}px` }}
            onClick={() => handleToss(target.id)}
          >
            {target.hit ? "✓" : "●"}
          </button>
        ))}
      </div>
      <div className="game-score">Score: {score}</div>
      {allHit && (
        <div className="game-over-modal">
          <div>PERFECT TOSS! Score: {score}</div>
          <button onClick={onComplete} className="game-button">
            Next Level →
          </button>
        </div>
      )}
    </div>
  );
}

// ========== DRAW SOMETHING GAME ==========
export function DrawSomethingGame({ onComplete }: { onComplete: () => void }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fffdf8";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#1f1d1a";
    ctx.lineWidth = 3;
  }, []);

  const handleMouseDown = (e: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.beginPath();
    ctx.moveTo(e.clientX - rect.left, e.clientY - rect.top);
    setIsDrawing(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    ctx.lineTo(e.clientX - rect.left, e.clientY - rect.top);
    ctx.stroke();
  };

  const handleMouseUp = () => setIsDrawing(false);

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fffdf8";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  if (submitted) {
    return (
      <div className="game-container">
        <div className="game-title">🎨 NICE DRAWING 🎨</div>
        <div className="game-result">
          <div>Your art has been received!</div>
          <button onClick={onComplete} className="game-button">
            Next Level →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="game-container">
      <div className="game-title">🎨 DRAW SOMETHING 🎨</div>
      <canvas
        ref={canvasRef}
        width={300}
        height={200}
        className="draw-canvas"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      />
      <div className="draw-controls">
        <button onClick={clearCanvas} className="game-button">
          Clear
        </button>
        <button onClick={() => setSubmitted(true)} className="game-button">
          Submit
        </button>
      </div>
    </div>
  );
}

// ========== PATTERN MATCHING GAME ==========
export function PatternGame({ onComplete }: { onComplete: () => void }) {
  const [pattern, setPattern] = useState<number[]>([]);
  const [userPattern, setUserPattern] = useState<number[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [level, setLevel] = useState(0);

  const colors = ["red", "blue", "green", "yellow"];

  useEffect(() => {
    if (!gameStarted) return;
    if (userPattern.length > 0 && userPattern[userPattern.length - 1] !== pattern[userPattern.length - 1]) {
      // Wrong!
      setGameStarted(false);
      setUserPattern([]);
    }
    if (userPattern.length === pattern.length && pattern.length > 0) {
      // Correct round!
      setTimeout(() => {
        const newPattern = [...pattern, Math.floor(Math.random() * 4)];
        setPattern(newPattern);
        setUserPattern([]);
        setLevel(level + 1);
      }, 500);
    }
  }, [userPattern, pattern, gameStarted, level]);

  const start = () => {
    setPattern([Math.floor(Math.random() * 4)]);
    setUserPattern([]);
    setGameStarted(true);
    setLevel(0);
  };

  if (level >= 5) {
    return (
      <div className="game-container">
        <div className="game-title">✨ PATTERN MASTER ✨</div>
        <div className="game-result">
          <div>You completed 5 levels! Amazing!</div>
          <button onClick={onComplete} className="game-button">
            Next Level →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="game-container">
      <div className="game-title">✨ SIMON SAYS ✨</div>
      {!gameStarted ? (
        <button onClick={start} className="mega-click-btn">
          START
        </button>
      ) : (
        <>
          <div className="pattern-grid">
            {colors.map((color, idx) => (
              <button
                key={idx}
                className={`pattern-btn ${color}`}
                onClick={() => setUserPattern([...userPattern, idx])}
              />
            ))}
          </div>
          <div className="game-score">Level: {level + 1}/5</div>
        </>
      )}
    </div>
  );
}
