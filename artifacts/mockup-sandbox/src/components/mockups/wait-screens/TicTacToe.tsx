import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Loader2, RefreshCw, Gamepad2 } from 'lucide-react';

const TOTAL_DURATION = 24000;
const TICK_RATE = 100;

// How long the AI "grumbles" and sets up the board after you opt in.
const SETUP_DURATION = 1800;
// In the self-running canvas preview, how long to sit on the idle screen
// before auto-starting the demo so reviewers can watch the whole sequence.
const AUTO_IDLE_DELAY = 2600;

const STAGES = [
  { time: 0, label: 'Analyzing prompt for "busy parents in Austin"...' },
  { time: 4000, label: 'Structuring layout for modern family dentistry...' },
  { time: 9000, label: 'Writing copy highlighting "trusted local dentist"...' },
  { time: 15000, label: 'Setting up online booking integration...' },
  { time: 20000, label: 'Finalizing design with teal accents...' },
];

type Player = 'X' | 'O' | null;
type Phase = 'idle' | 'setup' | 'playing';

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

function evaluate(squares: Player[]): Player | 'Draw' | null {
  for (const [a, b, c] of WIN_LINES) {
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
      return squares[a];
    }
  }
  if (!squares.includes(null)) return 'Draw';
  return null;
}

// Perfect-play minimax. AI is 'O' (maximizer), human is 'X' (minimizer).
function minimax(squares: Player[], isMaximizing: boolean, depth: number): number {
  const result = evaluate(squares);
  if (result === 'O') return 10 - depth;
  if (result === 'X') return depth - 10;
  if (result === 'Draw') return 0;

  if (isMaximizing) {
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (squares[i] === null) {
        squares[i] = 'O';
        best = Math.max(best, minimax(squares, false, depth + 1));
        squares[i] = null;
      }
    }
    return best;
  }
  let best = Infinity;
  for (let i = 0; i < 9; i++) {
    if (squares[i] === null) {
      squares[i] = 'X';
      best = Math.min(best, minimax(squares, true, depth + 1));
      squares[i] = null;
    }
  }
  return best;
}

// Returns the index of the optimal move for 'O'. Unbeatable.
function findBestMove(board: Player[]): number {
  let bestScore = -Infinity;
  let bestMove = -1;
  for (let i = 0; i < 9; i++) {
    if (board[i] === null) {
      const next = [...board];
      next[i] = 'O';
      const score = minimax(next, false, 1);
      if (score > bestScore) {
        bestScore = score;
        bestMove = i;
      }
    }
  }
  return bestMove;
}

export function TicTacToe() {
  const [elapsed, setElapsed] = useState(0);
  const [round, setRound] = useState(0);
  const [phase, setPhase] = useState<Phase>('idle');
  // Auto-mode drives the looping canvas demo. The moment a human interacts,
  // we hand control over and stop auto-resetting their game.
  const [autoMode, setAutoMode] = useState(true);
  const [aiThinking, setAiThinking] = useState(false);

  const [board, setBoard] = useState<Player[]>(Array(9).fill(null));
  const [xIsNext, setXIsNext] = useState<boolean>(true);
  const [winner, setWinner] = useState<Player | 'Draw' | null>(null);

  // Progress Simulation (loops)
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed((prev) => (prev + TICK_RATE >= TOTAL_DURATION ? 0 : prev + TICK_RATE));
    }, TICK_RATE);
    return () => clearInterval(interval);
  }, []);

  // Detect when the progress bar wraps around → advance the demo "round".
  const prevElapsedRef = useRef(0);
  useEffect(() => {
    if (elapsed < prevElapsedRef.current) {
      setRound((r) => r + 1);
    }
    prevElapsedRef.current = elapsed;
  }, [elapsed]);

  const resetBoard = useCallback(() => {
    setBoard(Array(9).fill(null));
    setXIsNext(true);
    setWinner(null);
    setAiThinking(false);
  }, []);

  // On a new demo round, reset back to the idle screen — but only while still
  // auto-running. If a human has taken over, leave their game alone.
  useEffect(() => {
    if (round === 0) return;
    if (!autoMode) return;
    setPhase('idle');
    resetBoard();
  }, [round, autoMode, resetBoard]);

  // Auto-demo: after sitting idle for a beat, start the game on its own.
  useEffect(() => {
    if (!autoMode || phase !== 'idle') return;
    const t = setTimeout(() => setPhase('setup'), AUTO_IDLE_DELAY);
    return () => clearTimeout(t);
  }, [autoMode, phase, round]);

  // The impatient "setup" beat, then the board appears.
  useEffect(() => {
    if (phase !== 'setup') return;
    resetBoard();
    const t = setTimeout(() => setPhase('playing'), SETUP_DURATION);
    return () => clearTimeout(t);
  }, [phase, resetBoard]);

  const progress = Math.min(100, (elapsed / TOTAL_DURATION) * 100);
  const timeRemaining = Math.max(0, Math.ceil((TOTAL_DURATION - elapsed) / 1000));

  const currentStage = [...STAGES].reverse().find((s) => elapsed >= s.time)?.label || STAGES[0].label;

  const handleStartGame = () => {
    setAutoMode(false);
    setPhase('setup');
  };

  const handlePlay = useCallback((index: number) => {
    if (board[index] || winner || !xIsNext || aiThinking) return;
    setAutoMode(false);

    const newBoard = [...board];
    newBoard[index] = 'X';
    setBoard(newBoard);
    setXIsNext(false);
    setWinner(evaluate(newBoard));
  }, [board, winner, xIsNext, aiThinking]);

  // AI Move — takes a deliberate, slightly variable beat so it reads as "thinking".
  useEffect(() => {
    if (phase !== 'playing' || xIsNext || winner) return;
    setAiThinking(true);
    const delay = 900 + Math.random() * 600; // ~0.9s–1.5s
    const timer = setTimeout(() => {
      setBoard((current) => {
        if (evaluate(current)) return current;
        const move = findBestMove(current);
        if (move === -1) return current;
        const newBoard = [...current];
        newBoard[move] = 'O'; // Unbeatable: perfect-play minimax. Best you can do is draw.
        setWinner(evaluate(newBoard));
        return newBoard;
      });
      setXIsNext(true);
      setAiThinking(false);
    }, delay);
    return () => clearTimeout(timer);
  }, [phase, xIsNext, winner]);

  const resetGame = () => {
    setAutoMode(false);
    resetBoard();
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans text-slate-900">
      <div className="w-full max-w-xl mx-auto space-y-10">

        {/* Progress Section */}
        <div className="space-y-6 bg-white p-8 rounded-2xl shadow-sm border border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-slate-800 tracking-tight flex items-center gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
                Building your page
              </h1>
              <p className="text-slate-500 mt-1">for Northwind Dental</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-light text-slate-700">{timeRemaining}s</div>
              <div className="text-xs text-slate-400 uppercase tracking-wider font-medium">Remaining</div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between text-sm font-medium">
              <span className="text-teal-700">{currentStage}</span>
              <span className="text-slate-400">{Math.round(progress)}%</span>
            </div>
            <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-teal-500 rounded-full transition-all ease-linear"
                style={{ width: `${progress}%`, transitionDuration: `${TICK_RATE}ms` }}
              />
            </div>
          </div>
        </div>

        {/* Game Section */}
        <div className="flex flex-col items-center">
          {phase === 'idle' && (
            <div className="text-center space-y-5 animate-in fade-in duration-500">
              <div className="space-y-1.5">
                <h2 className="text-lg font-medium text-slate-700">Preview's running a little behind...</h2>
                <p className="text-sm text-slate-500 max-w-sm mx-auto">
                  My colleague's still rendering it. Want to kill a few seconds while we wait?
                </p>
              </div>
              <button
                onClick={handleStartGame}
                className="inline-flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-medium px-5 py-2.5 rounded-xl shadow-sm transition-colors"
              >
                <Gamepad2 className="w-4 h-4" />
                Play a game while we wait
              </button>
            </div>
          )}

          {phase === 'setup' && (
            <div className="text-center space-y-4 animate-in fade-in duration-300 py-4">
              <p className="text-base font-medium text-slate-700 max-w-md mx-auto">
                Ugh, still loading? Fine — let me set up a quick game.
              </p>
              <div className="flex items-center justify-center gap-2 text-sm text-slate-400">
                <Loader2 className="w-4 h-4 animate-spin text-teal-500" />
                Setting up the board...
              </div>
            </div>
          )}

          {phase === 'playing' && (
            <div className="flex flex-col items-center space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
              <div className="text-center space-y-1">
                <h2 className="text-lg font-medium text-slate-700">Got a sec to kill? Your move...</h2>
                <p className="text-sm text-slate-500">The generation continues in the background.</p>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 inline-block">
                <div className="grid grid-cols-3 gap-2">
                  {board.map((cell, idx) => (
                    <button
                      key={idx}
                      onClick={() => handlePlay(idx)}
                      disabled={!!cell || !!winner || !xIsNext || aiThinking}
                      className={`w-20 h-20 text-3xl flex items-center justify-center rounded-xl bg-slate-50 transition-colors
                        ${!cell && !winner && xIsNext && !aiThinking ? 'hover:bg-teal-50 cursor-pointer' : 'cursor-default'}
                        ${cell === 'X' ? 'text-teal-600 font-semibold' : 'text-slate-400'}
                      `}
                    >
                      {cell}
                    </button>
                  ))}
                </div>

                <div className="mt-6 h-8 flex items-center justify-center">
                  {winner ? (
                    <div className="flex items-center gap-4 animate-in fade-in zoom-in duration-300">
                      <span className="font-medium text-slate-700">
                        {winner === 'Draw' ? "It's a draw!" : `Player ${winner} wins!`}
                      </span>
                      <button
                        onClick={resetGame}
                        className="flex items-center gap-1.5 text-sm font-medium text-teal-600 hover:text-teal-700 transition-colors px-3 py-1.5 rounded-lg hover:bg-teal-50"
                      >
                        <RefreshCw className="w-4 h-4" />
                        Play again
                      </button>
                    </div>
                  ) : (
                    <span className="text-sm text-slate-400">
                      {aiThinking ? 'AI is thinking...' : 'Your turn (X)'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
