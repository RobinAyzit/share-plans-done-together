import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { Plus, Share2, Trash2, Pencil, Check, Users, User, ArrowLeft, Home, Camera, History, X, Smile, Sun, Moon } from 'lucide-react';
import { compressAndToBase64 } from './lib/utils';
import { useAuth } from './hooks/useAuth';
import {
  usePlans,
  usePlan,
  createPlan,
  updateItem,
  deleteItem,
  toggleItemChecked,
  addItemToPlan,
  deletePlan,
  updatePlan,
  addMemberToPlan,
  toggleReaction,
  cleanupExpiredPlans
} from './hooks/useFirestore';
import { useFriendRequests } from './hooks/useFriends';
import { getInviteByCode, incrementInviteUse } from './hooks/useInvites';
import { useNotifications } from './hooks/useNotifications';
import { JoinModal } from './components/JoinModal';
import { AuthModal } from './components/AuthModal';
import { FriendsModal } from './components/FriendsModal';
import { ShareModal } from './components/ShareModal';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { ErrorBoundary } from './components/ErrorBoundary';
import type { Plan, Item } from './types';

const EMOJIS = ['❤️', '🔥', '💪', '🙏', '😂', '💯']; // Reactions supported by the app

function App() {
  const { t } = useTranslation();
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('theme') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    localStorage.setItem('theme', theme);
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);
  const { user, userProfile, loading: authLoading, error: authError, signInWithGoogle, signOut, isAuthenticated } = useAuth();
  const { plans, loading: _plansLoading } = usePlans(user?.uid);
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const { plan: currentPlan } = usePlan(currentPlanId);
  const { incomingRequests } = useFriendRequests(user?.uid);

  // Register for push notifications
  useNotifications(user?.uid);

  const [activeTab, setActiveTab] = useState<'home' | 'plans' | 'completed' | 'profile'>('home');
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFriendsModal, setShowFriendsModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingItem, setEditingItem] = useState<{ planId: string; item: Item } | null>(null);
  const [newPlanName, setNewPlanName] = useState('');
  const [toast, setToast] = useState('');
  const [addInput, setAddInput] = useState('');
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [itemFile, setItemFile] = useState<File | null>(null);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [activeReactionPicker, setActiveReactionPicker] = useState<string | null>(null);

  // Invite handling state
  const [pendingInviteCode, setPendingInviteCode] = useState<string | null>(null);
  const [joiningPlan, setJoiningPlan] = useState(false);

  // Check for invite code in URL on mount
  useEffect(() => {
    const path = window.location.pathname;
    if (path.includes('/join/')) {
      const parts = path.split('/join/');
      const code = parts[parts.length - 1];
      if (code) {
        setPendingInviteCode(code);
      }
    }
  }, []);

  // Auto-cleanup expired completed plans (30 days)
  useEffect(() => {
    if (isAuthenticated && user?.uid) {
      cleanupExpiredPlans(user.uid).catch(console.error);
    }
  }, [isAuthenticated, user?.uid]);

  // Handle joining plan when authenticated
  useEffect(() => {
    const handleJoin = async () => {
      if (!pendingInviteCode || !user || !userProfile || joiningPlan) return;

      setJoiningPlan(true);
      try {
        const invite = await getInviteByCode(pendingInviteCode);

        if (!invite) {
          showToast(t('plans.join_invalid'));
          setPendingInviteCode(null);
          window.history.replaceState({}, '', '/');
          return;
        }

        await addMemberToPlan(
          invite.planId,
          user.uid,
          userProfile.email,
          userProfile.displayName,
          userProfile.photoURL
        );

        await incrementInviteUse(pendingInviteCode);

        showToast(`Gick med i ${invite.planName}!`);
        setCurrentPlanId(invite.planId);
        setActiveTab('plans');

        // Cleanup
        setPendingInviteCode(null);
        window.history.replaceState({}, '', '/');
      } catch (error) {
        console.error('Error joining plan:', error);
        showToast(t('plans.join_error'));
      } finally {
        setJoiningPlan(false);
      }
    };

    handleJoin();
  }, [pendingInviteCode, user, userProfile]);

  // Show auth modal on load if not authenticated
  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated) {
        setShowAuthModal(true);
      } else {
        setShowAuthModal(false);
      }
    }
  }, [authLoading, isAuthenticated]);

  // Trigger confetti when plan is completed
  useEffect(() => {
    if (currentPlan?.completed) {
      triggerConfetti();
    }
  }, [currentPlan?.completed]);

  // Auto-cleanup for plans completed more than 30 days ago
  useEffect(() => {
    if (plans.length > 0 && isAuthenticated) {
      const now = Date.now();
      const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;

      const oldPlans = plans.filter(plan => {
        if (!plan.completed || !plan.completedAt) return false;
        const completedTime = plan.completedAt.toMillis();
        return (now - completedTime) > thirtyDaysInMs;
      });

      if (oldPlans.length > 0) {
        console.log(`Auto-cleaning ${oldPlans.length} old plans...`);
        oldPlans.forEach(plan => {
          deletePlan(plan.id);
        });
      }
    }
  }, [plans, isAuthenticated]);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(''), 2200);
  };

  const handleToggleReaction = async (planId: string, itemId: string, emoji: string) => {
    if (!user || !userProfile) return;
    try {
      await toggleReaction(planId, itemId, user.uid, userProfile.displayName, emoji);
    } catch (err: any) {
      showToast(t('plans.update_error'));
    }
  };

  const triggerConfetti = () => {
    const count = 200;
    const defaults = { origin: { y: 0.7 } };

    function fire(particleRatio: number, opts: any) {
      confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio),
      });
    }

    fire(0.25, { spread: 26, startVelocity: 55 });
    fire(0.2, { spread: 60 });
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
    fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
    fire(0.1, { spread: 120, startVelocity: 45 });
  };

  const createNewPlan = async () => {
    if (!newPlanName.trim() || !user || !userProfile || creatingPlan) return;

    setCreatingPlan(true);
    try {
      let imageUrl = undefined;
      if (selectedFile) {
        imageUrl = await compressAndToBase64(selectedFile);
      }

      const planId = await createPlan(
        newPlanName.trim(),
        user.uid,
        userProfile.email,
        userProfile.displayName,
        userProfile.photoURL,
        imageUrl
      );

      setNewPlanName('');
      setSelectedFile(null);
      setImagePreview(null);
      setShowCreateModal(false);
      setCurrentPlanId(planId);
      setActiveTab('plans');
      showToast(t('plans.plan_created'));
    } catch (error: any) {
      console.error('Error creating plan:', error);
      showToast(t('plans.create_error'));
    } finally {
      setCreatingPlan(false);
    }
  };

  const handleToggleItem = async (planId: string, itemId: string) => {
    if (!user || !userProfile) return;

    try {
      await toggleItemChecked(planId, itemId, user.uid, userProfile.displayName);
    } catch (error: any) {
      console.error('Error toggling item:', error);
      showToast(t('plans.update_error'));
    }
  };

  const handleAddItem = async (planId: string, text: string) => {
    if (!text.trim()) return;
    try {
      let imageUrl = undefined;
      if (itemFile) {
        imageUrl = await compressAndToBase64(itemFile);
      }

      if (!user || !userProfile) return;
      await addItemToPlan(planId, text.trim(), user.uid, userProfile.displayName, imageUrl);
      setAddInput('');
      setItemFile(null);
      showToast(t('plans.item_added'));
    } catch (error: any) {
      console.error('Error adding item:', error);
      showToast(t('plans.create_error'));
    }
  };

  const handleDeleteItem = async (planId: string, itemId: string) => {
    try {
      await deleteItem(planId, itemId);
      showToast(t('plans.item_removed'));
    } catch (error: any) {
      console.error('Error deleting item:', error);
    }
  };

  const handleEditItem = async (planId: string, itemId: string, newText: string) => {
    if (!newText.trim()) return;

    try {
      await updateItem(planId, itemId, { text: newText.trim() });
      setShowEditModal(false);
      setEditingItem(null);
      showToast(t('plans.item_updated'));
    } catch (error: any) {
      console.error('Error editing item:', error);
    }
  };

  const handleDeletePlan = async (planId: string) => {
    const plan = plans.find(p => p.id === planId);
    if (!plan) return;

    // Only owner can delete active plans, anyone can delete completed ones
    if (plan.ownerId !== user?.uid && !plan.completed) {
      showToast(t('plans.only_owner_can_delete'));
      return;
    }

    if (window.confirm(plan.completed ? t('plans.delete_completed_plan_confirm') : t('plans.delete_plan_confirm'))) {
      try {
        await deletePlan(planId);
        if (currentPlanId === planId) {
          setCurrentPlanId(null);
        }
        showToast(t('plans.plan_deleted'));
      } catch (error: any) {
        console.error('Error deleting plan:', error);
        showToast(t('plans.plan_deleted_error'));
      }
    }
  };

  const handleReopenPlan = async (planId: string) => {
    try {
      await updatePlan(planId, { completed: false });
      showToast(t('plans.plan_reopened'));
    } catch (error: any) {
      console.error('Error reopening plan:', error);
    }
  };

  const openEditModal = (planId: string, item: Item) => {
    setEditingItem({ planId, item });
    setShowEditModal(true);
  };

  const getProgress = (plan: Plan) => {
    if (!plan.items || plan.items.length === 0) return 0;
    const checked = plan.items.filter((i) => i.checked).length;
    return Math.round((checked / plan.items.length) * 100);
  };

  const sortedPlans = [...plans].sort((a, b) => {
    const timeA = a.created?.toMillis?.() || 0;
    const timeB = b.created?.toMillis?.() || 0;
    return timeB - timeA;
  });
  const activePlans = sortedPlans.filter((p) => !p.completed);
  const completedPlans = sortedPlans.filter((p) => p.completed);

  if (authLoading) {
    return (
      <div className={`min-h-screen ${theme === 'dark' ? 'dark bg-zinc-950 text-white' : 'bg-zinc-50 text-zinc-900'} flex items-center justify-center`}>
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-4 overflow-hidden rounded-3xl">
            <img src="pwa-icon.png" className="w-full h-full object-cover scale-[1.6]" alt="DoneTogether" />
          </div>
          <p className="text-zinc-500 font-bold italic uppercase tracking-widest text-xs">{t('common.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-white font-sans selection:bg-emerald-500/30 transition-colors duration-300">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 dark:bg-zinc-950/80 border-b border-zinc-200 dark:border-zinc-800/50 backdrop-blur-xl">
        <div className="max-w-3xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 overflow-hidden rounded-xl rotate-3 hover:rotate-6 transition-transform shadow-lg shadow-black/5 dark:shadow-none">
              <img src="pwa-icon.png" className="w-full h-full object-cover scale-[1.5]" alt="Logo" />
            </div>
            <h1 className="text-xl font-black italic tracking-tighter">Done<span className="text-emerald-500">Together</span></h1>
          </div>

          <div className="flex items-center gap-4">
            {incomingRequests && incomingRequests.length > 0 && (
              <button
                onClick={() => setShowFriendsModal(true)}
                className="relative p-2 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                title={t('common.friends_requests') || 'Friends Requests'}
              >
                <Users className="w-5 h-5" />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white dark:border-zinc-950">
                  {incomingRequests.length}
                </span>
              </button>
            )}

            {isAuthenticated && userProfile ? (
              <button
                onClick={() => setActiveTab('profile')}
                className="flex items-center gap-3 p-1 pr-3 rounded-2xl bg-zinc-100 dark:bg-transparent hover:bg-zinc-200 dark:hover:bg-zinc-900 transition-colors border border-zinc-200 dark:border-transparent dark:hover:border-zinc-800"
              >
                {userProfile.photoURL ? (
                  <img src={userProfile.photoURL} className="w-8 h-8 rounded-xl object-cover border border-zinc-200 dark:border-zinc-800" alt="" />
                ) : (
                  <div className="w-8 h-8 rounded-xl bg-zinc-200 dark:bg-zinc-800 flex items-center justify-center text-zinc-500 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700">
                    <User className="w-4 h-4" />
                  </div>
                )}
                <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300 hidden sm:block">{userProfile.displayName}</span>
              </button>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="px-4 py-2 rounded-xl bg-emerald-500 text-black font-bold text-sm hover:scale-105 active:scale-95 transition-all shadow-lg shadow-emerald-500/20"
              >
                {t('auth.login')}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="pt-24 pb-32 max-w-3xl mx-auto px-6 h-screen overflow-y-auto overflow-x-hidden scroll-smooth scrollbar-hide">
        <AnimatePresence mode="wait">
          {activeTab === 'home' && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="space-y-8 pb-12"
            >
              {/* Hero Section */}
              <div className="bg-gradient-to-br from-emerald-500/10 to-transparent p-8 rounded-[32px] border border-emerald-500/10 dark:border-emerald-500/10">
                <h2 className="text-3xl font-bold mb-3 tracking-tight leading-tight italic font-black">{t('home.hero_title')}</h2>
                <p className="text-zinc-600 dark:text-zinc-400 leading-relaxed mb-6 max-w-md italic">
                  {t('home.hero_subtitle')}
                </p>
                <div className="flex flex-wrap gap-3">
                  <button
                    onClick={() => {
                      if (isAuthenticated) setShowCreateModal(true);
                      else setShowAuthModal(true);
                    }}
                    className="px-6 py-3.5 rounded-2xl bg-emerald-500 text-black font-bold flex items-center gap-2 hover:scale-105 active:scale-95 transition-all shadow-xl shadow-emerald-500/20"
                  >
                    <Plus className="w-5 h-5 stroke-[3px]" />
                    {t('home.create_plan')}
                  </button>

                  <button
                    onClick={() => {
                      if (isAuthenticated) setShowJoinModal(true);
                      else setShowAuthModal(true);
                    }}
                    className="px-6 py-3.5 rounded-2xl bg-white dark:bg-zinc-800 text-zinc-900 dark:text-white font-bold flex items-center gap-2 hover:scale-105 active:scale-95 transition-all border border-zinc-200 dark:border-zinc-700 hover:border-zinc-300 dark:hover:border-zinc-600 shadow-sm"
                  >
                    {t('home.join_plan')}
                  </button>
                </div>
              </div>

              {/* Active Plans List */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                  <h3 className="text-zinc-400 dark:text-zinc-500 text-xs font-bold uppercase tracking-[0.2em]">{t('home.active_plans')}</h3>
                  <span className="text-zinc-400 dark:text-zinc-600 text-xs font-medium">{t('home.plans_count', { count: activePlans.length })}</span>
                </div>

                {activePlans.length > 0 ? (
                  <div className="grid grid-cols-1 gap-4">
                    {activePlans.map((plan) => (
                      <motion.div
                        key={plan.id}
                        layoutId={plan.id}
                        onClick={() => {
                          setCurrentPlanId(plan.id);
                          setActiveTab('plans');
                        }}
                        className="group bg-white dark:bg-zinc-900/40 p-5 rounded-3xl border border-zinc-200 dark:border-zinc-800/50 hover:border-emerald-500/30 hover:bg-zinc-50 dark:hover:bg-zinc-900/60 transition-all cursor-pointer overflow-hidden relative shadow-sm hover:shadow-md"
                      >
                        {plan.imageUrl && (
                          <div className="absolute top-0 right-0 w-32 h-full opacity-5 dark:opacity-10 group-hover:opacity-10 dark:group-hover:opacity-20 transition-opacity">
                            <img src={plan.imageUrl} className="w-full h-full object-cover grayscale" alt={plan.name} />
                            <div className="absolute inset-0 bg-gradient-to-l from-white dark:from-zinc-950 via-white/40 dark:via-zinc-950/40 to-transparent" />
                          </div>
                        )}
                        <div className="flex items-center justify-between mb-4 relative z-10">
                          <h4 className="font-bold text-lg text-zinc-900 dark:text-white group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition-colors uppercase italic tracking-tight">{plan.name}</h4>
                          <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 text-[10px] font-bold tracking-widest uppercase">
                            {getProgress(plan)}% {t('plans.completed')}
                          </span>
                        </div>
                        <div className="w-full h-1.5 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden mb-4 relative z-10">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${getProgress(plan)}%` }}
                            className="h-full bg-emerald-500 rounded-full"
                          />
                        </div>
                        <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-500 italic relative z-10">
                          <span>{t('plans.step_of', { current: plan.items?.filter(i => i.checked).length || 0, total: plan.items?.length || 0 })}</span>
                          <div className="flex -space-x-2">
                            {plan.members && Object.values(plan.members).slice(0, 3).map((m: any, i) => (
                              <img
                                key={i}
                                src={m.photoURL || `https://ui-avatars.com/api/?name=${m.displayName}&background=333&color=fff`}
                                className="w-6 h-6 rounded-lg border-2 border-white dark:border-zinc-900 object-cover"
                                alt=""
                              />
                            ))}
                            {plan.members && Object.keys(plan.members).length > 3 && (
                              <div className="w-6 h-6 rounded-lg border-2 border-white dark:border-zinc-900 bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-[8px] font-bold text-zinc-500 dark:text-zinc-400">
                                +{Object.keys(plan.members).length - 3}
                              </div>
                            )}
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12 bg-white dark:bg-zinc-900/20 rounded-3xl border border-dashed border-zinc-200 dark:border-zinc-800">
                    <p className="text-zinc-400 dark:text-zinc-500 italic text-sm">{t('home.no_active_plans')}</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {activeTab === 'plans' && (
            <motion.div
              key="plan-detail"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6 pb-12"
            >
              {!currentPlanId ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-6">
                    <button onClick={() => setActiveTab('home')} className="p-2 -ml-2 rounded-xl bg-white dark:bg-transparent border border-zinc-200 dark:border-transparent hover:bg-zinc-50 dark:hover:bg-zinc-900 text-zinc-400 transition-colors">
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h2 className="text-2xl font-black italic tracking-tight uppercase text-zinc-900 dark:text-white">{t('plans.all_plans')}</h2>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-zinc-400 dark:text-zinc-500 text-[10px] font-bold uppercase tracking-[0.2em] px-2">{t('home.active_plans')}</h3>
                    {activePlans.length > 0 ? activePlans.map(plan => (
                      <div
                        key={plan.id}
                        onClick={() => setCurrentPlanId(plan.id)}
                        className="flex items-center justify-between p-4 rounded-2xl bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 hover:border-emerald-500/20 transition-all cursor-pointer group shadow-sm hover:shadow-md"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-400 dark:text-zinc-500 group-hover:bg-emerald-500 group-hover:text-black transition-all overflow-hidden border border-zinc-100 dark:border-zinc-700">
                            {plan.imageUrl ? <img src={plan.imageUrl} className="w-full h-full object-cover" alt={plan.name} /> : <Plus className="w-5 h-5" />}
                          </div>
                          <div>
                            <div className="font-bold text-zinc-800 dark:text-zinc-200 group-hover:text-zinc-950 dark:group-hover:text-white uppercase italic tracking-tight transition-colors">{plan.name}</div>
                            <div className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase">{plan.items?.filter(i => i.checked).length || 0}/{plan.items?.length || 0} TAGNA</div>
                          </div>
                        </div>
                        {plan.ownerId === user?.uid && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePlan(plan.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-2 text-zinc-300 dark:text-zinc-600 hover:text-red-500 transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )) : (
                      <p className="text-zinc-400 dark:text-zinc-600 text-sm italic px-2">Inga aktiva planer.</p>
                    )}
                  </div>
                </div>
              ) : currentPlan ? (
                <div className="space-y-6">
                  {/* DETAIL VIEW */}
                  <div className="space-y-4">
                    <button
                      onClick={() => setCurrentPlanId(null)}
                      className="flex items-center gap-2 text-zinc-400 dark:text-zinc-500 text-xs font-black uppercase tracking-widest hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      {t('common.back')}
                    </button>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div
                          onClick={() => currentPlan.imageUrl && setFullscreenImage(currentPlan.imageUrl)}
                          className={`w-14 h-14 rounded-2xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20 overflow-hidden rotate-2 border-2 border-white dark:border-zinc-950 ${currentPlan.imageUrl ? 'cursor-pointer hover:scale-110 active:scale-95 transition-transform' : ''}`}
                        >
                          {currentPlan.imageUrl ? (
                            <img src={currentPlan.imageUrl} className="w-full h-full object-cover" alt={currentPlan.name} />
                          ) : (
                            <Check className="w-8 h-8 text-black stroke-[3px]" />
                          )}
                        </div>
                        <div>
                          <h2 className="text-3xl font-black italic tracking-tighter uppercase leading-none mb-1 text-zinc-900 dark:text-white">{currentPlan.name}</h2>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-2 py-1 rounded-lg">
                              {t('common.by') || 'BY'} {currentPlan.members?.[currentPlan.ownerId]?.displayName || t('common.unknown')}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setShowShareModal(true)}
                          className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all shadow-sm"
                        >
                          <Share2 className="w-5 h-5 text-zinc-700 dark:text-zinc-300" />
                        </button>
                        {(currentPlan.ownerId === user?.uid || currentPlan.completed) && (
                          <button
                            onClick={() => handleDeletePlan(currentPlan.id)}
                            className="p-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-red-50 dark:hover:bg-red-500/10 text-zinc-400 hover:text-red-500 transition-all shadow-sm"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="p-5 bg-white dark:bg-zinc-900/40 rounded-[24px] border border-zinc-200 dark:border-zinc-800/50 shadow-sm">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 dark:text-zinc-500">{t('plans.progress')}</span>
                        <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 italic">{getProgress(currentPlan)}% {t('plans.completed')}</span>
                      </div>
                      <div className="h-3 bg-zinc-100 dark:bg-zinc-950 rounded-full overflow-hidden border border-zinc-100 dark:border-zinc-800">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${getProgress(currentPlan)}%` }}
                          className="h-full bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.3)]"
                        />
                      </div>
                    </div>
                  </div>

                  {!currentPlan.completed && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        handleAddItem(currentPlan.id, addInput);
                      }}
                      className="relative group"
                    >
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                        <label className="cursor-pointer text-zinc-500 dark:text-zinc-600 hover:text-emerald-500 transition-colors bg-zinc-50 dark:bg-zinc-950 p-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800">
                          <Camera className="w-5 h-5" />
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) setItemFile(file);
                          }} />
                        </label>
                        {itemFile && (
                          <div className="relative">
                            <img src={URL.createObjectURL(itemFile)} className="w-7 h-7 rounded-lg border border-emerald-500 object-cover" alt="" />
                            <button type="button" onClick={() => setItemFile(null)} className="absolute -top-1 -right-1 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-white rounded-full border border-zinc-200 dark:border-zinc-800">
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        )}
                      </div>
                      <input
                        type="text"
                        value={addInput}
                        onChange={(e) => setAddInput(e.target.value)}
                        placeholder={t('plans.what_else')}
                        className="w-full bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-3xl py-5 pl-20 pr-14 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all font-bold italic shadow-sm"
                      />
                      <button type="submit" disabled={!addInput.trim()} className="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 bg-emerald-500 text-black rounded-xl disabled:opacity-20 shadow-lg shadow-emerald-500/20 transition-all hover:scale-110 active:scale-95">
                        <Plus className="w-5 h-5 stroke-[4px]" />
                      </button>
                    </form>
                  )}

                  <div className="space-y-3">
                    {currentPlan.items && currentPlan.items.length > 0 ? (
                      [...currentPlan.items].sort((a, b) => (a.checked === b.checked ? 0 : a.checked ? 1 : -1)).map((item) => (
                        <motion.div
                          key={item.id}
                          layout
                          className={`flex items-start gap-4 p-5 rounded-3xl border transition-all group ${item.checked ? 'bg-zinc-50 dark:bg-zinc-950 border-emerald-500/10 dark:border-emerald-500/10 opacity-70' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 shadow-md dark:shadow-xl dark:shadow-black/20'}`}
                        >
                          <button
                            onClick={() => handleToggleItem(currentPlan.id, item.id)}
                            className={`mt-1 w-7 h-7 rounded-xl border-2 flex items-center justify-center transition-all ${item.checked ? 'bg-emerald-500 border-emerald-500 text-black shadow-lg shadow-emerald-500/20' : 'border-zinc-700 hover:border-emerald-500'}`}
                          >
                            {item.checked && <Check className="w-4 h-4 stroke-[4px]" />}
                          </button>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between">
                              <div className="space-y-1">
                                <p className={`text-lg font-black italic tracking-tighter transition-all leading-tight ${item.checked ? 'line-through text-zinc-400 dark:text-zinc-600' : 'text-zinc-900 dark:text-zinc-100'}`}>
                                  {item.text}
                                </p>
                                {item.checked && item.checkedBy && (
                                  <div className="text-[10px] font-black uppercase tracking-[0.1em] text-emerald-600 dark:text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded inline-block">
                                    {t('plans.fixed_by', { name: item.checkedBy })}
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                {!item.checked && (
                                  <button onClick={() => openEditModal(currentPlan.id, item)} className="p-2 text-zinc-600 hover:text-white rounded-lg hover:bg-zinc-800">
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                )}
                                <button onClick={() => handleDeleteItem(currentPlan.id, item.id)} className="p-2 text-zinc-600 hover:text-red-500 rounded-lg hover:bg-zinc-800">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            {item.imageUrl && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                onClick={() => setFullscreenImage(item.imageUrl!)}
                                className="mt-4 rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 shadow-md dark:shadow-2xl cursor-pointer hover:border-emerald-500/30 transition-colors"
                              >
                                <img src={item.imageUrl} className="w-full h-auto max-h-[400px] object-cover" alt="" />
                              </motion.div>
                            )}

                            {/* Reactions Section */}
                            <div className="mt-4 flex flex-wrap gap-2 items-center">
                              {item.reactions && item.reactions.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                  {Object.entries(
                                    item.reactions.reduce((acc, curr) => {
                                      acc[curr.emoji] = (acc[curr.emoji] || 0) + 1;
                                      return acc;
                                    }, {} as Record<string, number>)
                                  ).map(([emoji, count]) => (
                                    <button
                                      key={emoji}
                                      onClick={() => handleToggleReaction(currentPlan.id, item.id, emoji)}
                                      className={`px-2 py-1 rounded-xl text-xs font-bold border transition-all flex items-center gap-1 ${item.reactions?.some(r => r.userId === user?.uid && r.emoji === emoji) ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-600 dark:text-emerald-400' : 'bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-700/50 text-zinc-500 dark:text-zinc-400'}`}
                                    >
                                      <span>{emoji}</span>
                                      <span>{count}</span>
                                    </button>
                                  ))}
                                </div>
                              )}

                              <div className="relative">
                                <button
                                  onClick={() => setActiveReactionPicker(activeReactionPicker === item.id ? null : item.id)}
                                  className={`p-2 rounded-xl border transition-all ${activeReactionPicker === item.id ? 'bg-emerald-500 text-black border-emerald-500' : 'bg-zinc-50 dark:bg-zinc-800/40 border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors'}`}
                                >
                                  <Smile className="w-4 h-4" />
                                </button>

                                <AnimatePresence>
                                  {activeReactionPicker === item.id && (
                                    <motion.div
                                      initial={{ opacity: 0, y: 10, scale: 0.9 }}
                                      animate={{ opacity: 1, y: 0, scale: 1 }}
                                      exit={{ opacity: 0, y: 10, scale: 0.9 }}
                                      className="absolute bottom-full mb-3 left-0 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 p-2 rounded-2xl shadow-xl dark:shadow-2xl flex gap-1 z-20"
                                    >
                                      {EMOJIS.map(emoji => (
                                        <button
                                          key={emoji}
                                          onClick={() => {
                                            handleToggleReaction(currentPlan.id, item.id, emoji);
                                            setActiveReactionPicker(null);
                                          }}
                                          className="p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors text-xl"
                                        >
                                          {emoji}
                                        </button>
                                      ))}
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      ))
                    ) : (
                      <div className="text-center py-20 bg-white dark:bg-zinc-950/40 rounded-3xl border-2 border-dashed border-zinc-100 dark:border-zinc-900">
                        <p className="text-zinc-400 dark:text-zinc-600 font-bold italic">{t('plans.empty_plan')}</p>
                      </div>
                    )}
                  </div>

                  {currentPlan.completed && (
                    <div className="pt-10 text-center">
                      <button onClick={() => handleReopenPlan(currentPlan.id)} className="px-8 py-4 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl font-black italic tracking-widest uppercase hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-900 dark:text-white transition shadow-lg">
                        {t('plans.reopen_plan')}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-20">Planen kunde inte hittas.</div>
              )}
            </motion.div>
          )}

          {activeTab === 'profile' && userProfile && (
            <motion.div
              key="profile"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="space-y-8 pb-12"
            >
              <div className="bg-white dark:bg-zinc-900 p-8 rounded-[40px] border border-zinc-200 dark:border-zinc-800 shadow-xl dark:shadow-none relative overflow-hidden group">
                <div className="absolute -top-24 -right-24 w-64 h-64 bg-emerald-500/5 rounded-full blur-[80px]" />

                <div className="relative z-10 flex flex-col items-center text-center">
                  <div className="relative mb-6">
                    {userProfile.photoURL ? (
                      <img src={userProfile.photoURL} alt="" className="w-32 h-32 rounded-[40px] border-4 border-emerald-500/20 p-1 group-hover:scale-105 transition-transform duration-500 shadow-xl" />
                    ) : (
                      <div className="w-32 h-32 rounded-[40px] bg-zinc-100 dark:bg-zinc-800 border-4 border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-5xl text-zinc-400 font-bold">
                        {userProfile.displayName?.[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>
                  <h3 className="text-3xl font-black italic uppercase tracking-tighter mb-1 text-zinc-900 dark:text-white">{userProfile.displayName}</h3>
                  <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium tracking-tight mb-10">{userProfile.email}</p>

                  <div className="grid grid-cols-2 gap-4 w-full mb-8">
                    <button onClick={() => setActiveTab('completed')} className="bg-zinc-50 dark:bg-zinc-800/40 p-6 rounded-[28px] text-center border border-zinc-200 dark:border-zinc-800 hover:border-emerald-500/20 dark:hover:border-emerald-500/30 transition-all hover:-translate-y-1">
                      <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mb-1">{completedPlans.length}</div>
                      <div className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest flex items-center justify-center gap-2">
                        <Check className="w-3 h-3" /> {t('plans.completed')}
                      </div>
                    </button>
                    <button onClick={() => setShowFriendsModal(true)} className="bg-zinc-50 dark:bg-zinc-800/40 p-6 rounded-[28px] text-center border border-zinc-200 dark:border-zinc-800 hover:border-emerald-500/20 dark:hover:border-emerald-500/30 transition-all hover:-translate-y-1">
                      <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 mb-1">{userProfile.friends?.length || 0}</div>
                      <div className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest flex items-center justify-center gap-2">
                        <Users className="w-3 h-3" /> {t('common.friends') || 'Friends'}
                      </div>
                    </button>
                  </div>

                  {/* Language Selection */}
                  <div className="w-full mb-4">
                    <div className="flex flex-col items-center justify-between p-6 rounded-[28px] bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50">
                      <p className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest leading-none mb-4">{t('profile.language')}</p>
                      <LanguageSwitcher />
                    </div>
                  </div>

                  {/* Theme Toggle */}
                  <div className="w-full mb-8">
                    <div className="flex items-center justify-between p-6 rounded-[28px] bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-700/50">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${theme === 'light' ? 'bg-amber-100 text-amber-600' : 'bg-zinc-950 text-zinc-400'}`}>
                          {theme === 'light' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                        </div>
                        <div className="text-left">
                          <p className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest leading-none mb-1">{t('profile.theme')}</p>
                          <p className="text-xs font-bold text-zinc-900 dark:text-white uppercase italic">{theme === 'light' ? t('profile.light') : t('profile.dark')}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                        className={`w-12 h-6 rounded-full transition-all relative border-2 ${theme === 'light' ? 'bg-emerald-500 border-emerald-600' : 'bg-zinc-700 border-zinc-600'}`}
                      >
                        <motion.div
                          animate={{ x: theme === 'light' ? 24 : 0 }}
                          className="w-4 h-4 rounded-full bg-white shadow-sm flex items-center justify-center m-0.5"
                        />
                      </button>
                    </div>
                  </div>

                  {/* Buy Me A Coffee Section */}
                  <div className="w-full mb-6">
                    <a
                      href="https://buymeacoffee.com/nrnworld"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block p-6 rounded-[28px] bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/20 dark:to-orange-950/20 border-2 border-amber-200 dark:border-amber-900/30 hover:border-amber-300 dark:hover:border-amber-800/50 transition-all hover:shadow-lg hover:-translate-y-1 group"
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 w-16 h-16 flex items-center justify-center group-hover:scale-110 transition-transform">
                          <img src="coffee-icon.png" alt="Coffee" className="w-full h-full object-contain" />
                        </div>
                        <div className="flex-1 text-left">
                          <h4 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-tight mb-2">
                            {t('profile.wall_of_fame.title')}
                          </h4>
                          <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200 mb-3 leading-relaxed">
                            {t('profile.wall_of_fame.subtitle')} ☕
                          </p>
                          <p className="text-[10px] text-zinc-700 dark:text-zinc-300 leading-relaxed mb-2">
                            {t('profile.wall_of_fame.text1')}
                          </p>
                          <p className="text-[10px] text-zinc-700 dark:text-zinc-300 leading-relaxed mb-2">
                            {t('profile.wall_of_fame.text2')}
                          </p>
                          <p className="text-[10px] text-zinc-700 dark:text-zinc-300 leading-relaxed mb-2">
                            {t('profile.wall_of_fame.text3')}
                          </p>
                          <p className="text-[10px] text-zinc-700 dark:text-zinc-300 leading-relaxed mb-2">
                            {t('profile.wall_of_fame.text4')}
                          </p>
                          <p className="text-[9px] text-zinc-600 dark:text-zinc-400 italic font-semibold">
                            {t('profile.wall_of_fame.signature')}
                          </p>
                        </div>
                      </div>
                    </a>
                  </div>

                  <button
                    onClick={signOut}
                    className="w-full flex items-center justify-center gap-3 p-6 rounded-[28px] bg-red-500/5 border border-red-500/10 text-red-500 font-black italic uppercase tracking-widest hover:bg-red-500/10 transition-all"
                  >
                    {t('auth.logout')}
                  </button>

                  {/* Copyright Footer */}
                  <div className="w-full text-center py-6 mt-4">
                    <p className="text-[10px] text-zinc-400 dark:text-zinc-600 font-medium tracking-wide">
                      Created by © 2024 nRn World
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'completed' && (
            <motion.div
              key="completed"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6 pb-12"
            >
              <div className="flex items-center gap-4 mb-4">
                <button onClick={() => setActiveTab('profile')} className="p-2.5 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-400 transition-colors">
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <h2 className="text-3xl font-black italic tracking-tighter uppercase">{t('plans.completed')}</h2>
              </div>

              <div className="space-y-4">
                {completedPlans.length > 0 ? completedPlans.map(plan => {
                  const daysLeft = plan.completedAt ? Math.max(0, 30 - Math.floor((Date.now() - plan.completedAt.toMillis()) / (24 * 60 * 60 * 1000))) : 30;

                  return (
                    <div key={plan.id} className="group flex flex-col p-6 rounded-[32px] bg-white dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800 hover:border-emerald-500/20 transition-all relative overflow-hidden shadow-sm hover:shadow-md">
                      {plan.imageUrl && (
                        <div className="absolute top-0 right-0 w-48 h-full opacity-5 dark:opacity-5 group-hover:opacity-10 transition-opacity">
                          <img src={plan.imageUrl} className="w-full h-full object-cover grayscale" alt={plan.name} />
                          <div className="absolute inset-0 bg-gradient-to-l from-white dark:from-zinc-950 via-white/60 dark:via-zinc-950/60 to-transparent" />
                        </div>
                      )}

                      <div className="flex items-start justify-between relative z-10 mb-6">
                        <div className="flex items-center gap-5">
                          <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-500 border border-emerald-500/20">
                            <Check className="w-6 h-6 stroke-[3px]" />
                          </div>
                          <div>
                            <h4 className="text-xl font-black text-zinc-900 dark:text-zinc-100 italic uppercase tracking-tight">{plan.name}</h4>
                            <div className="flex flex-col gap-0.5 mt-1">
                              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-black uppercase tracking-widest">
                                {plan.completedAt ? `KLAR ${plan.completedAt.toDate().toLocaleDateString('sv-SE')}` : 'AVKLARAD'}
                              </p>
                              <p className="text-[9px] font-bold text-red-500/80 uppercase tracking-tight">
                                Raderas automatiskt om {daysLeft} {daysLeft === 1 ? 'dag' : 'dagar'}
                              </p>
                            </div>
                          </div>
                        </div>
                        <button onClick={() => handleDeletePlan(plan.id)} className="p-3.5 rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:bg-red-500/10 hover:text-red-500 transition-all">
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-[0.1em] text-zinc-400 dark:text-zinc-500 relative z-10 border-t border-zinc-100 dark:border-zinc-800/50 pt-5">
                        <span>{plan.items?.length || 0} PUNKTER AVKLARADE</span>
                        <button onClick={() => handleReopenPlan(plan.id)} className="text-emerald-600 dark:text-emerald-500 hover:text-emerald-500 dark:hover:text-emerald-400 transition-colors bg-emerald-500/10 px-4 py-2 rounded-xl border border-emerald-500/20">
                          ÅTERUPPTA
                        </button>
                      </div>
                    </div>
                  );
                }) : (
                  <div className="text-center py-20 bg-white dark:bg-zinc-950/20 rounded-[40px] border-2 border-dashed border-zinc-200 dark:border-zinc-900">
                    <History className="w-16 h-16 text-zinc-200 dark:text-zinc-900 mx-auto mb-6" />
                    <p className="text-zinc-400 dark:text-zinc-600 font-black italic uppercase tracking-widest text-xs">Inga slutförda planer än.</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Navigation Bar */}
      <footer className="fixed bottom-0 left-0 right-0 z-50 bg-white/80 dark:bg-zinc-950/80 border-t border-zinc-200 dark:border-zinc-800/50 backdrop-blur-xl pb-safe shadow-[0_-4px_20px_rgba(0,0,0,0.03)] dark:shadow-none">
        <div className="max-w-3xl mx-auto px-10 h-20 flex items-center justify-between">
          <button
            onClick={() => setActiveTab('home')}
            className={`flex flex-col items-center gap-1.5 transition-all ${activeTab === 'home' ? 'text-emerald-500 scale-110' : 'text-zinc-400 dark:text-zinc-600 hover:text-emerald-500 dark:hover:text-zinc-400'}`}
          >
            <Home className="w-6 h-6 stroke-[2.5px]" />
            <span className="text-[9px] font-black uppercase tracking-widest">{t('common.home') || 'Home'}</span>
          </button>

          <button
            onClick={() => {
              if (isAuthenticated) setShowCreateModal(true);
              else setShowAuthModal(true);
            }}
            className="w-16 h-16 bg-emerald-500 text-black rounded-3xl flex items-center justify-center -mt-12 shadow-[0_20px_40px_rgba(16,185,129,0.3)] hover:scale-110 active:scale-90 transition-all border-4 border-zinc-50 dark:border-zinc-950 rotate-3"
          >
            <Plus className="w-8 h-8 stroke-[4px]" />
          </button>

          <button
            onClick={() => {
              setCurrentPlanId(null);
              setActiveTab('plans');
            }}
            className={`flex flex-col items-center gap-1.5 transition-all ${activeTab === 'plans' ? 'text-emerald-500 scale-110' : 'text-zinc-400 dark:text-zinc-600 hover:text-emerald-500 dark:hover:text-zinc-400'}`}
          >
            <Check className="w-6 h-6 stroke-[2.5px]" />
            <span className="text-[9px] font-black uppercase tracking-widest">{t('plans.all_plans')}</span>
          </button>

          <button
            onClick={() => setActiveTab('completed')}
            className={`flex flex-col items-center gap-1.5 transition-all ${activeTab === 'completed' ? 'text-emerald-500 scale-110' : 'text-zinc-400 dark:text-zinc-600 hover:text-emerald-500 dark:hover:text-zinc-400'}`}
          >
            <History className="w-6 h-6 stroke-[2.5px]" />
            <span className="text-[9px] font-black uppercase tracking-widest">{t('plans.completed')}</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`flex flex-col items-center gap-1.5 transition-all ${activeTab === 'profile' ? 'text-emerald-500 scale-110' : 'text-zinc-400 dark:text-zinc-600 hover:text-emerald-500 dark:hover:text-zinc-400'}`}
          >
            <User className="w-6 h-6 stroke-[2.5px]" />
            <span className="text-[9px] font-black uppercase tracking-widest">{t('profile.title')}</span>
          </button>
        </div>
      </footer>

      {/* Modals */}
      <AnimatePresence>
        {showAuthModal && (
          <AuthModal
            onClose={() => setShowAuthModal(false)}
            onSignIn={signInWithGoogle}
            error={authError || undefined}
          />
        )}

        {showCreateModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-0">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowCreateModal(false)} className="absolute inset-0 bg-white/60 dark:bg-zinc-950/95 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 40 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 40 }} className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-[40px] border border-zinc-200 dark:border-zinc-800 p-10 shadow-2xl overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-2 bg-emerald-500" />
              <button onClick={() => setShowCreateModal(false)} className="absolute top-8 right-8 text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white transition-colors">
                <X className="w-6 h-6" />
              </button>

              <h2 className="text-3xl font-black italic uppercase tracking-tighter mb-8 text-zinc-900 dark:text-white">{t('home.create_plan')}</h2>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest ml-1">Vad ska planen heta?</label>
                  <input
                    type="text"
                    value={newPlanName}
                    onChange={(e) => setNewPlanName(e.target.value)}
                    placeholder="T.ex. Sommarstugan 2024"
                    className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl py-5 px-6 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all font-bold italic text-lg text-zinc-900 dark:text-white placeholder:text-zinc-300 dark:placeholder:text-zinc-700 shadow-inner"
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-400 dark:text-zinc-500 uppercase tracking-widest ml-1">Omslagsbild (Snyggt!)</label>
                  <div className="relative group overflow-hidden rounded-[24px] border-2 border-dashed border-zinc-200 dark:border-zinc-800 hover:border-emerald-500/40 transition-all aspect-video flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 cursor-pointer">
                    {imagePreview ? (
                      <>
                        <img src={imagePreview} className="w-full h-full object-cover" alt="" />
                        <button type="button" onClick={(e) => { e.stopPropagation(); setSelectedFile(null); setImagePreview(null); }} className="absolute top-3 right-3 p-2 bg-black/80 rounded-full text-white hover:bg-black border border-white/10 transition-colors">
                          <X className="w-5 h-5" />
                        </button>
                      </>
                    ) : (
                      <div className="flex flex-col items-center">
                        <Camera className="w-10 h-10 text-zinc-200 dark:text-zinc-800 group-hover:text-emerald-500 transition-colors mb-4" />
                        <span className="text-[10px] font-black text-zinc-400 dark:text-zinc-600 group-hover:text-emerald-500 transition-colors tracking-widest uppercase">Klicka för att välja bild</span>
                      </div>
                    )}
                    <input type="file" accept="image/*" className="absolute inset-0 opacity-0 cursor-pointer" onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        setSelectedFile(file);
                        const reader = new FileReader();
                        reader.onloadend = () => setImagePreview(reader.result as string);
                        reader.readAsDataURL(file);
                      }
                    }} />
                  </div>
                </div>

                <div className="pt-6 flex gap-3">
                  <button onClick={() => setShowCreateModal(false)} className="flex-1 py-5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-zinc-200 dark:hover:bg-zinc-700 transition">{t('common.cancel')}</button>
                  <button
                    onClick={createNewPlan}
                    disabled={!newPlanName.trim() || creatingPlan}
                    className="flex-[1.5] py-5 bg-emerald-500 text-black rounded-2xl text-sm font-black uppercase tracking-widest disabled:opacity-30 transition hover:bg-emerald-400 shadow-xl shadow-emerald-500/20"
                  >
                    {creatingPlan ? t('common.loading') : t('home.create_plan')}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {showFriendsModal && userProfile && (
          <FriendsModal onClose={() => setShowFriendsModal(false)} currentUser={userProfile} />
        )}

        {showJoinModal && user && userProfile && (
          <JoinModal onClose={() => setShowJoinModal(false)} onJoin={(planId) => { setCurrentPlanId(planId); setActiveTab('plans'); showToast('Gick med i planen!'); }} user={user} userProfile={userProfile} />
        )}

        {showShareModal && currentPlan && userProfile && (
          <ShareModal onClose={() => setShowShareModal(false)} plan={currentPlan} currentUserId={user?.uid || ''} currentUserName={userProfile.displayName} />
        )}

        {showEditModal && editingItem && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-0">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setShowEditModal(false); setEditingItem(null); }} className="absolute inset-0 bg-white/60 dark:bg-zinc-950/95 backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.9, y: 30 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 30 }} className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-[32px] border border-zinc-200 dark:border-zinc-800 p-10 shadow-2xl overflow-hidden">
              <h2 className="text-3xl font-black italic uppercase tracking-tighter mb-8 text-zinc-900 dark:text-white">{t('common.edit')}</h2>
              <input
                type="text"
                defaultValue={editingItem.item.text}
                id="edit-item-input"
                className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl py-5 px-6 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 transition-all font-bold italic text-lg text-zinc-900 dark:text-white shadow-inner"
                autoFocus
              />
              <div className="pt-8 flex gap-3">
                <button onClick={() => { setShowEditModal(false); setEditingItem(null); }} className="flex-1 py-5 bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-zinc-200 dark:hover:bg-zinc-700 transition">{t('common.cancel')}</button>
                <button onClick={() => { const input = document.getElementById('edit-item-input') as HTMLInputElement; handleEditItem(editingItem.planId, editingItem.item.id, input.value); }} className="flex-[1.5] py-5 bg-emerald-500 text-black rounded-2xl text-xs font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20 active:scale-95 transition-all">{t('common.save')}</button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Fullscreen Image Preview */}
        {fullscreenImage && (
          <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setFullscreenImage(null)}
              className="absolute inset-0 bg-white/60 dark:bg-zinc-950/95 backdrop-blur-xl cursor-zoom-out"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="relative max-w-5xl w-full max-h-[90vh] flex items-center justify-center p-4"
            >
              <img
                src={fullscreenImage}
                className="w-full h-full object-contain rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
                alt="Fullskärmsvy"
              />
              <button
                onClick={() => setFullscreenImage(null)}
                className="absolute -top-2 -right-2 w-12 h-12 bg-zinc-950 dark:bg-white text-white dark:text-black rounded-full flex items-center justify-center border border-white/10 dark:border-zinc-800 hover:scale-110 active:scale-90 transition-all shadow-xl z-10"
              >
                <X className="w-6 h-6 stroke-[3px]" />
              </button>
            </motion.div>
          </div>
        )}

        {/* Toast Notifier */}
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 60, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed bottom-28 left-1/2 -translate-x-1/2 z-[200] px-6 py-3.5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-[10px] font-black uppercase tracking-widest shadow-2xl flex items-center gap-3 text-zinc-900 dark:text-white"
          >
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AppWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  );
}

export default AppWithErrorBoundary;
