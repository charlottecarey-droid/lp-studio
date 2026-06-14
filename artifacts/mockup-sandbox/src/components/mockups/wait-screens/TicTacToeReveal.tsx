import React, { useState, useEffect, useCallback } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';

// Phase timings for the self-running canvas demo.
const ASSEMBLE_DURATION = 3000; // tiles snap in, looks like a page building
const REVEAL_DURATION = 2400;   // the "...wait, that's not your page" beat
const AUTO_RESTART_DELAY = 6500; // if nobody plays, loop the gag for the preview

type Player = 'X' | 'O' | null;
type Phase = 'assembling' | 'reveal' | 'playing';

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

// Fake "page section" skeletons so the assembling grid reads like a real layout.
const SECTION_SKELETONS = [
  ['w-3/4 h-2.5', 'w-full h-1.5', 'w-5/6 h-1.5'],
  ['w-1/2 h-2.5', 'w-full h-1.5'],
  ['w-2/3 h-2.5', 'w-full h-1.5', 'w-1/2 h-4 mt-1 rounded-md'],
  ['w-full h-1.5', 'w-5/6 h-1.5', 'w-2/3 h-1.5'],
  ['w-1/2 h-2.5', 'w-1/3 h-4 mt-1 rounded-md'],
  ['w-3/4 h-2.5', 'w-full h-1.5'],
  ['w-2/3 h-2.5', 'w-full h-1.5', 'w-4/5 h-1.5'],
  ['w-1/2 h-2.5', 'w-full h-1.5', 'w-2/3 h-1.5'],
  ['w-3/4 h-2.5', 'w-1/2 h-4 mt-1 rounded-md'],
];

export function TicTacToeReveal() {
  const [phase, setPhase] = useState<Phase>('assembling');
  const [assembled, setAssembled] = useState(0); // how many tiles have snapped in
  const [autoMode, setAutoMode] = useState(true);

  const [board, setBoard] = useState<Player[]>(Array(9).fill(null));
  const [xIsNext, setXIsNext] = useState<boolean>(true);
  const [winner, setWinner] = useState<Player | 'Draw' | null>(null);
  const [aiThinking, setAiThinking] = useState(false);

  const resetBoard = useCallback(() => {
    setBoard(Array(9).fill(null));
    setXIsNext(true);
    setWinner(null);
    setAiThinking(false);
  }, []);

  // Stagger the tiles snapping in during assembly.
  useEffect(() => {
    if (phase !== 'assembling') return;
    setAssembled(0);
    const perTile = (ASSEMBLE_DURATION - 600) / 9;
    const timers = Array.from({ length: 9 }, (_, i) =>
      setTimeout(() => setAssembled((n) => Math.max(n, i + 1)), i * perTile + 200),
    );
    const toReveal = setTimeout(() => setPhase('reveal'), ASSEMBLE_DURATION);
    return () => {
      timers.forEach(clearTimeout);
      clearTimeout(toReveal);
    };
  }, [phase]);

  // The twist beat, then the board becomes playable.
  useEffect(() => {
    if (phase !== 'reveal') return;
    const t = setTimeout(() => {
      resetBoard();
      setPhase('playing');
    }, REVEAL_DURATION);
    return () => clearTimeout(t);
  }, [phase, resetBoard]);

  // If nobody plays, loop the whole gag so the canvas preview keeps demoing it.
  useEffect(() => {
    if (phase !== 'playing' || !autoMode) return;
    if (board.some((c) => c !== null)) return;
    const t = setTimeout(() => setPhase('assembling'), AUTO_RESTART_DELAY);
    return () => clearTimeout(t);
  }, [phase, autoMode, board]);

  const handlePlay = useCallback((index: number) => {
    if (phase !== 'playing' || board[index] || winner || !xIsNext || aiThinking) return;
    setAutoMode(false);
    const newBoard = [...board];
    newBoard[index] = 'X';
    setBoard(newBoard);
    setXIsNext(false);
    setWinner(evaluate(newBoard));
  }, [phase, board, winner, xIsNext, aiThinking]);

  // AI move — deliberate, slightly variable beat so it reads as "thinking".
  useEffect(() => {
    if (phase !== 'playing' || xIsNext || winner) return;
    setAiThinking(true);
    const delay = 900 + Math.random() * 600;
    const timer = setTimeout(() => {
      setBoard((current) => {
        if (evaluate(current)) return current;
        const move = findBestMove(current);
        if (move === -1) return current;
        const newBoard = [...current];
        newBoard[move] = 'O'; // Unbeatable perfect play. Best you can do is draw.
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

  const showingPage = phase === 'assembling' || phase === 'reveal';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 font-sans text-slate-900">
      <div className="w-full max-w-md mx-auto space-y-6">

        {/* Header — sells the "building your page" illusion, then softens */}
        <div className="flex items-center justify-center px-1">
          <div className="flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
            <div>
              <h1 className="text-lg font-semibold text-slate-800 tracking-tight">
                {showingPage ? 'Building your page' : 'Still building your page'}
              </h1>
              <p className="text-xs text-slate-500">
                {showingPage ? 'for Northwind Dental' : 'hang tight — it runs in the background'}
              </p>
            </div>
          </div>
        </div>

        {/* The 3x3 area: first a page layout assembling, then the game board */}
        <div className="relative bg-white p-4 rounded-2xl shadow-sm border border-slate-100 w-fit mx-auto">
          {/* faux browser chrome */}
          <div className="flex items-center gap-1.5 px-1 pb-3 mb-3 border-b border-slate-100">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-200" />
            <span className="w-2.5 h-2.5 rounded-full bg-slate-200" />
            <span className="w-2.5 h-2.5 rounded-full bg-slate-200" />
            <span className="ml-3 text-[11px] text-slate-400 truncate">northwinddental.com</span>
          </div>

          <div className="grid grid-cols-3 gap-2 w-fit mx-auto">
            {board.map((cell, idx) => {
              const isIn = idx < assembled;
              return (
                <button
                  key={idx}
                  onClick={() => handlePlay(idx)}
                  disabled={showingPage || !!cell || !!winner || !xIsNext || aiThinking}
                  style={showingPage ? { transitionDelay: `${idx * 40}ms` } : undefined}
                  className={`relative w-28 h-28 rounded-xl flex items-center justify-center overflow-hidden transition-all duration-500
                    ${showingPage
                      ? `bg-slate-50 ${isIn ? 'opacity-100 scale-100' : 'opacity-0 scale-90'}`
                      : 'bg-slate-50 opacity-100 scale-100'}
                    ${phase === 'playing' && !cell && !winner && xIsNext && !aiThinking ? 'hover:bg-teal-50 cursor-pointer' : ''}
                    ${phase === 'playing' && (cell || winner || !xIsNext) ? 'cursor-default' : ''}
                  `}
                >
                  {/* Skeleton "page section" content while assembling/revealing */}
                  {showingPage && (
                    <div
                      className={`absolute inset-0 p-2.5 flex flex-col gap-1.5 justify-center transition-opacity duration-500
                        ${phase === 'reveal' ? 'opacity-0' : 'opacity-100'}`}
                    >
                      {SECTION_SKELETONS[idx].map((bar, b) => (
                        <span key={b} className={`bg-slate-200 rounded-sm animate-pulse ${bar}`} />
                      ))}
                    </div>
                  )}

                  {/* Game mark */}
                  {!showingPage && (
                    <span
                      className={`text-4xl animate-in fade-in zoom-in duration-200
                        ${cell === 'X' ? 'text-teal-600 font-semibold' : 'text-slate-400'}`}
                    >
                      {cell}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* The reveal overlay */}
          {phase === 'reveal' && (
            <div className="absolute inset-0 rounded-2xl bg-white/85 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-300">
              <div className="text-center space-y-2 max-w-sm">
                <h2 className="text-xl font-semibold text-slate-800">...wait, that's not your page.</h2>
                <p className="text-sm text-slate-500">
                  It's a tic-tac-toe board. Your real one's still cooking — want to play while it finishes?
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Status line under the board (only while playing) */}
        <div className="h-9 flex items-center justify-center">
          {phase === 'playing' && (
            winner ? (
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
            )
          )}
        </div>

      </div>
    </div>
  );
}
