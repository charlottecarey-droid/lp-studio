import React from 'react';
import { Star, Medal, Award, Trophy } from 'lucide-react';

export function RatingBadges() {
  return (
    <section className="w-full bg-white h-[480px] px-8 flex flex-col items-center justify-center font-sans">
      <div className="max-w-6xl mx-auto w-full flex flex-col items-center gap-10">
        <h2 className="text-sm font-semibold tracking-widest text-slate-400 uppercase text-center">
          Trusted by leading teams worldwide
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 w-full">
          {/* Badge 1 */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-xl text-slate-900 tracking-tight">ReviewHub</span>
            </div>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <p className="text-sm text-slate-600 font-medium">4.9/5 <span className="text-slate-400 font-normal">(842 reviews)</span></p>
            <div className="mt-2 bg-slate-100 text-slate-700 text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1.5">
              <Medal className="w-3.5 h-3.5" /> High Performer
            </div>
          </div>

          {/* Badge 2 */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 shadow-lg relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10" />
            <div className="relative z-10 flex items-center gap-2 mb-1">
              <span className="font-bold text-xl text-white tracking-tight">SoftRank</span>
            </div>
            <div className="relative z-10 flex gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <p className="relative z-10 text-sm text-slate-300 font-medium">4.8/5 <span className="text-slate-500 font-normal">(1.2k+ reviews)</span></p>
            <div className="relative z-10 mt-2 bg-indigo-500/20 text-indigo-200 border border-indigo-500/30 text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5" /> Industry Leader
            </div>
          </div>

          {/* Badge 3 */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-xl text-slate-900 tracking-tight">TrustScore</span>
            </div>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <p className="text-sm text-slate-600 font-medium">4.9/5 <span className="text-slate-400 font-normal">(421 reviews)</span></p>
            <div className="mt-2 bg-slate-100 text-slate-700 text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5" /> Top Rated 2024
            </div>
          </div>

          {/* Badge 4 */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col items-center justify-center gap-3 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-bold text-xl text-slate-900 tracking-tight">PeerVoice</span>
            </div>
            <div className="flex gap-1">
              {[1, 2, 3, 4].map((i) => (
                <Star key={i} className="w-5 h-5 fill-amber-400 text-amber-400" />
              ))}
              <div className="relative w-5 h-5">
                <Star className="w-5 h-5 text-amber-400" />
                <div className="absolute inset-0 overflow-hidden w-[50%]">
                  <Star className="w-5 h-5 fill-amber-400 text-amber-400" />
                </div>
              </div>
            </div>
            <p className="text-sm text-slate-600 font-medium">4.5/5 <span className="text-slate-400 font-normal">(289 reviews)</span></p>
            <div className="mt-2 bg-emerald-50 text-emerald-700 text-xs font-semibold px-3 py-1 rounded-full flex items-center gap-1.5 border border-emerald-100">
              Best Support
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
