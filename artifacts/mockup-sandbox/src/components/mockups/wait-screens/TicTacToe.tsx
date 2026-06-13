import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';

const TOTAL_DURATION = 24000;
const TICK_RATE = 100;

const STAGES = [
  { time: 0, label: 'Analyzing prompt for "busy parents in Austin"...' },
  { time: 4000, label: 'Structuring layout for modern family dentistry...' },
  { time: 9000, label: 'Writing copy highlighting "trusted local dentist"...' },
  { time: 15000, label: 'Setting up online booking integration...' },
  { time: 20000, label: 'Finalizing design with teal accents...' },
];

type Player = 'X' | 'O' | null;

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
  const [board, setBoard] = useState<Player[]>(Array(9).fill(null));
  const [xIsNext, setXIsNext] = useState<boolean>(true);
  const [winner, setWinner] = useState<Player | 'Draw' | null>(null);

  // Progress Simulation
  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed((prev) => {
        if (prev >= TOTAL_DURATION) {
          // Reset game on loop if desired, or keep it. Let's keep game state but loop progress.
          return 0;
        }
        return prev + TICK_RATE;
      });
    }, TICK_RATE);

    return () => clearInterval(interval);
  }, []);

  const progress = Math.min(100, (elapsed / TOTAL_DURATION) * 100);
  const timeRemaining = Math.max(0, Math.ceil((TOTAL_DURATION - elapsed) / 1000));
  
  const currentStage = [...STAGES].reverse().find((s) => elapsed >= s.time)?.label || STAGES[0].label;

  // Tic-Tac-Toe Logic
  const checkWinner = (squares: Player[]) => {
    const lines = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
      [0, 4, 8], [2, 4, 6]             // diagonals
    ];
    for (let i = 0; i < lines.length; i++) {
      const [a, b, c] = lines[i];
      if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
        return squares[a];
      }
    }
    if (!squares.includes(null)) return 'Draw';
    return null;
  };

  const handlePlay = useCallback((index: number) => {
    if (board[index] || winner || !xIsNext) return;

    const newBoard = [...board];
    newBoard[index] = 'X';
    setBoard(newBoard);
    setXIsNext(false);
    setWinner(checkWinner(newBoard));
  }, [board, winner, xIsNext]);

  // AI Move
  useEffect(() => {
    if (!xIsNext && !winner) {
      const timer = setTimeout(() => {
        const move = findBestMove(board);
        if (move !== -1) {
          // Unbeatable AI: perfect-play minimax. Best the user can do is draw.
          const newBoard = [...board];
          newBoard[move] = 'O';
          setBoard(newBoard);
          setXIsNext(true);
          setWinner(checkWinner(newBoard));
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [xIsNext, winner, board]);

  const resetGame = () => {
    setBoard(Array(9).fill(null));
    setXIsNext(true);
    setWinner(null);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans text-slate-900">
      <div className="w-full max-w-xl mx-auto space-y-12">
        
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
        <div className="flex flex-col items-center space-y-6">
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
                  disabled={!!cell || !!winner || !xIsNext}
                  className={`w-20 h-20 text-3xl flex items-center justify-center rounded-xl bg-slate-50 transition-colors
                    ${!cell && !winner && xIsNext ? 'hover:bg-teal-50 cursor-pointer' : 'cursor-default'}
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
                  {xIsNext ? 'Your turn (X)' : 'AI is thinking...'}
                </span>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
