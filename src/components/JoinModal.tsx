import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, ArrowRight, Loader, Link as LinkIcon } from 'lucide-react';
import { getInviteByCode, incrementInviteUse } from '../hooks/useInvites';
import { addMemberToPlan } from '../hooks/useFirestore';
import type { UserProfile } from '../types';

interface JoinModalProps {
    onClose: () => void;
    onJoin: (planId: string) => void;
    user: { uid: string };
    userProfile: UserProfile;
}

export function JoinModal({ onClose, onJoin, user, userProfile }: JoinModalProps) {
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleJoin = async () => {
        if (!input.trim()) return;

        setLoading(true);
        setError('');

        try {
            // Extract code from URL if full link is pasted
            let code = input.trim();
            if (code.includes('/join/')) {
                code = code.split('/join/')[1];
            }

            const invite = await getInviteByCode(code);

            if (!invite) {
                setError('Ogiltig eller utgången inbjudningskod');
                setLoading(false);
                return;
            }

            await addMemberToPlan(
                invite.planId,
                user.uid,
                userProfile.email,
                userProfile.displayName,
                userProfile.photoURL
            );

            await incrementInviteUse(code);

            onJoin(invite.planId);
            onClose();
        } catch (err) {
            console.error('Error joining plan:', err);
            setError('Kunde inte gå med i planen. Försök igen.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 dark:bg-black/80 backdrop-blur-sm px-6">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white dark:bg-zinc-900 rounded-[32px] border border-zinc-200 dark:border-zinc-800 max-w-md w-full max-h-[90vh] p-8 sm:p-10 relative shadow-2xl overflow-y-auto scrollbar-hide"
            >
                <button
                    onClick={onClose}
                    className="absolute top-8 right-8 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition"
                >
                    <X className="w-6 h-6" />
                </button>

                <div className="mb-8">
                    <div className="w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-6 border border-purple-500/20 rotate-3">
                        <LinkIcon className="w-7 h-7 text-purple-600 dark:text-purple-400" />
                    </div>
                    <h2 className="text-3xl font-black italic uppercase tracking-tighter mb-2 text-zinc-900 dark:text-white">DoneTogether</h2>
                    <p className="text-zinc-500 dark:text-zinc-400 font-medium italic">
                        Klistra in en inbjudningslänk eller kod för att gå med i en plan.
                    </p>
                </div>

                <div className="space-y-6">
                    <div>
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="T.ex. https://.../join/ABC123"
                            className="w-full h-16 px-6 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all outline-none font-bold italic text-lg text-zinc-900 dark:text-white placeholder:text-zinc-300 dark:placeholder:text-zinc-700 shadow-inner"
                            autoFocus
                        />
                    </div>

                    {error && (
                        <div className="p-4 rounded-2xl bg-red-500/5 border border-red-500/20 text-red-500 text-sm font-bold text-center italic">
                            {error}
                        </div>
                    )}

                    <button
                        onClick={handleJoin}
                        disabled={loading || !input.trim()}
                        className="w-full h-16 bg-purple-600 dark:bg-purple-600 text-white rounded-2xl font-black italic uppercase tracking-widest hover:bg-purple-500 disabled:opacity-30 transition-all flex items-center justify-center gap-3 shadow-xl shadow-purple-500/20 active:scale-95"
                    >
                        {loading ? (
                            <>
                                <Loader className="w-5 h-5 animate-spin" />
                                Går med...
                            </>
                        ) : (
                            <>
                                Gå med nu
                                <ArrowRight className="w-5 h-5 stroke-[3px]" />
                            </>
                        )}
                    </button>
                </div>
            </motion.div>
        </div>
    );
}
