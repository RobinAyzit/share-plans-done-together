import { useState, useEffect, useCallback } from 'react';
import {
    collection,
    query,
    where,
    onSnapshot,
    doc,
    getDoc,
    updateDoc,
    Timestamp,
    arrayUnion,
    addDoc,
    deleteDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { Plan, PlanMember, Item, Comment } from '../types';
import { sendAppNotification } from '../lib/notifications';

export function usePlans(userId: string | undefined) {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(() => !!userId);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!userId) {
            return;
        }

        const plansRef = collection(db, 'plans');
        const q = query(plansRef, where(`members.${userId}`, '!=', null));

        const unsubscribe = onSnapshot(
            q,
            (snapshot) => {
                const plansData: Plan[] = [];
                snapshot.forEach((doc) => {
                    const data = doc.data();
                    plansData.push({
                        id: doc.id,
                        ...data,
                        items: data.items || [],
                        members: data.members || {},
                    } as Plan);
                });
                setPlans(plansData.sort((a, b) => {
                    const timeA = a.created?.toMillis?.() || 0;
                    const timeB = b.created?.toMillis?.() || 0;
                    return timeB - timeA;
                }));
                setLoading(false);
                setError(null);
            },
            (err) => {
                console.error('Error fetching plans:', err);
                setError(err.message);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [userId]);

    return { plans, loading, error };
}

export function usePlan(planId: string | null) {
    const [plan, setPlan] = useState<Plan | null>(null);
    const [loading, setLoading] = useState(() => !!planId);
    const [error, setError] = useState<string | null>(null);

    const checkRecurringTasks = useCallback(async (currentPlan: Plan) => {
        const now = Timestamp.now().toMillis();
        let needsUpdate = false;
        let updatedItems = [...currentPlan.items];
        let resetCompleted = false;

        // Check recurring items
        updatedItems = updatedItems.map(item => {
            if (item.recurring && item.recurring !== 'none' && item.checked && item.checkedAt) {
                const checkedTime = (item.checkedAt as Timestamp).toMillis();
                let shouldReset = false;
                
                const dayInMs = 24 * 60 * 60 * 1000;
                if (item.recurring === 'daily' && now - checkedTime >= dayInMs) shouldReset = true;
                if (item.recurring === 'weekly' && now - checkedTime >= 7 * dayInMs) shouldReset = true;
                if (item.recurring === 'monthly' && now - checkedTime >= 30 * dayInMs) shouldReset = true;
                if (item.recurring === 'yearly' && now - checkedTime >= 365 * dayInMs) shouldReset = true;

                if (shouldReset) {
                    needsUpdate = true;
                    return {
                        ...item,
                        checked: false,
                        checkedBy: undefined,
                        checkedByUid: undefined,
                        checkedAt: undefined,
                        imageUrl: undefined
                    };
                }
            }
            return item;
        });

        // Check recurring plan
        if (currentPlan.recurring && currentPlan.recurring !== 'none' && currentPlan.completed && currentPlan.completedAt) {
            const completedTime = (currentPlan.completedAt as Timestamp).toMillis();
            let shouldReset = false;
            const dayInMs = 24 * 60 * 60 * 1000;

            if (currentPlan.recurring === 'daily' && now - completedTime >= dayInMs) shouldReset = true;
            if (currentPlan.recurring === 'weekly' && now - completedTime >= 7 * dayInMs) shouldReset = true;
            if (currentPlan.recurring === 'monthly' && now - completedTime >= 30 * dayInMs) shouldReset = true;
            if (currentPlan.recurring === 'yearly' && now - completedTime >= 365 * dayInMs) shouldReset = true;

            if (shouldReset) {
                needsUpdate = true;
                resetCompleted = true;
                updatedItems = updatedItems.map(item => ({
                    ...item,
                    checked: false,
                    checkedBy: undefined,
                    checkedByUid: undefined,
                    checkedAt: undefined,
                    imageUrl: undefined
                }));
            }
        }

        if (needsUpdate) {
            const planRef = doc(db, 'plans', currentPlan.id);
            await updateDoc(planRef, {
                items: updatedItems,
                completed: resetCompleted ? false : currentPlan.completed,
                completedAt: resetCompleted ? null : currentPlan.completedAt,
                lastModified: Timestamp.now()
            });
        }
    }, []);

    useEffect(() => {
        if (!planId) {
            return;
        }

        const planRef = doc(db, 'plans', planId);

        const unsubscribe = onSnapshot(
            planRef,
            (snapshot) => {
                if (snapshot.exists()) {
                    const data = snapshot.data();
                    const fetchedPlan = {
                        id: snapshot.id,
                        ...data,
                        items: data.items || [],
                        members: data.members || {},
                    } as Plan;
                    setPlan(fetchedPlan);
                    checkRecurringTasks(fetchedPlan);
                } else {
                    setPlan(null);
                }
                setLoading(false);
                setError(null);
            },
            (err) => {
                console.error('Error fetching plan:', err);
                setError(err.message);
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, [planId, checkRecurringTasks]);

    return { plan, loading, error };
}

// Plan CRUD operations
export async function createPlan(
    name: string,
    userId: string,
    userEmail: string,
    userName: string,
    userPhoto?: string,
    imageUrl?: string,
    category?: string,
    color?: string,
    recurring?: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'none'
): Promise<string> {
    const plansRef = collection(db, 'plans');
    const newPlan: Omit<Plan, 'id'> = {
        name,
        ownerId: userId,
        members: {
            [userId]: {
                uid: userId,
                email: userEmail,
                displayName: userName,
                photoURL: userPhoto,
                role: 'owner',
                joinedAt: Timestamp.now(),
            },
        },
        items: [],
        created: Timestamp.now(),
        completed: false,
        lastModified: Timestamp.now(),
        imageUrl,
        category,
        color,
        recurring
    };
    const docRef = await addDoc(plansRef, newPlan);
    return docRef.id;
}

export async function updatePlan(planId: string, updates: Partial<Plan>) {
    const planRef = doc(db, 'plans', planId);

    // If we are reopening a plan, clear the completedAt timestamp
    const finalUpdates: Record<string, unknown> = { ...updates };
    if (updates.completed === false) {
        finalUpdates.completedAt = null;
    }

    await updateDoc(planRef, {
        ...finalUpdates,
        lastModified: Timestamp.now(),
    });
}

export async function deletePlan(planId: string) {
    const planRef = doc(db, 'plans', planId);
    await deleteDoc(planRef);
}

export async function addItemToPlan(
    planId: string,
    text: string,
    userId: string,
    userName: string,
    imageUrl?: string,
    deadline?: Timestamp,
    recurring?: 'daily' | 'weekly' | 'monthly' | 'yearly' | 'none'
): Promise<void> {
    const planRef = doc(db, 'plans', planId);
    const newItem: Item = {
        id: Math.random().toString(36).substring(2, 11),
        text,
        checked: false,
        imageUrl,
        deadline,
        recurring
    };
    await updateDoc(planRef, {
        items: arrayUnion(newItem),
        lastModified: Timestamp.now(),
        completed: false, // Reset completed if new item added
        completedAt: null, // Clear completion timestamp
    });

    // Notify others that a new item was added
    const planSnap = await getDoc(planRef);
    if (planSnap.exists()) {
        const plan = planSnap.data() as Plan;
        Object.keys(plan.members).forEach(uid => {
            if (uid !== userId) {
                sendAppNotification(uid, 'Ny punkt! 💡', `${userName} la till "${text}" i ${plan.name}`, 'plan_update', planId);
            }
        });
    }
}

export async function updateItem(planId: string, itemId: string, updates: Partial<Item>): Promise<void> {
    const planRef = doc(db, 'plans', planId);
    const planSnap = await getDoc(planRef);

    if (!planSnap.exists()) return;

    const plan = planSnap.data() as Plan;
    const updatedItems = plan.items.map((item) =>
        item.id === itemId ? { ...item, ...updates } : item
    );

    // Check if all items are completed
    const allChecked = updatedItems.length > 0 && updatedItems.every((i) => i.checked);

    await updateDoc(planRef, {
        items: updatedItems,
        completed: allChecked,
        completedAt: allChecked ? Timestamp.now() : null,
        lastModified: Timestamp.now(),
    });

    if (allChecked) {
        Object.keys(plan.members).forEach(uid => {
            sendAppNotification(uid, 'Plan slutförd! 🎉', `Planen "${plan.name}" är nu helt klar!`, 'plan_complete', planId);
        });
    }
}

export async function deleteItem(planId: string, itemId: string): Promise<void> {
    const planRef = doc(db, 'plans', planId);
    const planSnap = await getDoc(planRef);

    if (!planSnap.exists()) return;

    const plan = planSnap.data() as Plan;
    const updatedItems = plan.items.filter((item) => item.id !== itemId);
    const allChecked = updatedItems.length > 0 && updatedItems.every((i) => i.checked);

    await updateDoc(planRef, {
        items: updatedItems,
        completed: allChecked,
        completedAt: allChecked ? Timestamp.now() : null,
        lastModified: Timestamp.now(),
    });

    if (allChecked) {
        Object.keys(plan.members).forEach(uid => {
            sendAppNotification(uid, 'Plan slutförd! 🎉', `Planen "${plan.name}" är nu helt klar!`, 'plan_complete', planId);
        });
    }
}

export async function toggleItemChecked(
    planId: string,
    itemId: string,
    userId: string,
    displayName: string,
    imageUrl?: string
): Promise<void> {
    const planRef = doc(db, 'plans', planId);
    const planSnap = await getDoc(planRef);

    if (!planSnap.exists()) return;

    const plan = planSnap.data() as Plan;
    const item = plan.items.find(i => i.id === itemId);
    if (!item) return;

    const updatedItems = plan.items.map((i) => {
        if (i.id === itemId) {
            const newChecked = !i.checked;
            return {
                ...i,
                checked: newChecked,
                checkedAt: newChecked ? Timestamp.now() : undefined,
                checkedBy: newChecked ? displayName : undefined,
                checkedByUid: newChecked ? userId : undefined,
                imageUrl: newChecked ? (imageUrl || i.imageUrl) : i.imageUrl,
            };
        }
        return i;
    });

    const allChecked = updatedItems.length > 0 && updatedItems.every((i) => i.checked);
    const isNowChecked = !item.checked;

    await updateDoc(planRef, {
        items: updatedItems,
        completed: allChecked,
        completedAt: allChecked ? Timestamp.now() : null,
        lastModified: Timestamp.now(),
    });

    Object.keys(plan.members).forEach(uid => {
        if (uid !== userId) { // Don't notify the person who did it
            if (allChecked && isNowChecked) {
                sendAppNotification(uid, 'Plan slutförd! 🎉', `Planen "${plan.name}" är nu helt klar!`, 'plan_complete', planId);
            } else if (isNowChecked) {
                sendAppNotification(uid, 'Punkt avklarad! ✅', `${displayName} fixade "${item.text}" i ${plan.name}`, 'plan_update', planId);
            }
        }
    });
}

export async function addTaskComment(
    planId: string,
    itemId: string,
    userId: string,
    userName: string,
    userPhoto: string | undefined,
    text: string
): Promise<void> {
    const planRef = doc(db, 'plans', planId);
    const planSnap = await getDoc(planRef);
    if (!planSnap.exists()) return;

    const plan = planSnap.data() as Plan;
    const comment: Comment = {
        id: Math.random().toString(36).substr(2, 9),
        userId,
        userName,
        userPhoto,
        text,
        createdAt: Timestamp.now()
    };

    const updatedItems = plan.items.map(item => {
        if (item.id === itemId) {
            return {
                ...item,
                comments: [...(item.comments || []), comment]
            };
        }
        return item;
    });

    await updateDoc(planRef, {
        items: updatedItems,
        lastModified: Timestamp.now()
    });

    // Notify other members
    Object.keys(plan.members).forEach(uid => {
        if (uid !== userId) {
            sendAppNotification(
                uid,
                'Ny kommentar! 💬',
                `${userName} kommenterade "${text.substring(0, 20)}..." på en uppgift i ${plan.name}`,
                'plan_update',
                planId
            );
        }
    });

    // Special notification for the person who completed the task
    const item = plan.items.find(i => i.id === itemId);
    if (item && item.checkedByUid && item.checkedByUid !== userId) {
        sendAppNotification(
            item.checkedByUid,
            'Någon kommenterade din uppgift! 💬',
            `${userName} kommenterade på uppgiften "${item.text}" som du fixade!`,
            'plan_update',
            planId
        );
    }
}

export async function addMemberToPlan(
    planId: string,
    userId: string,
    userEmail: string,
    displayName: string,
    photoURL?: string,
    role: 'editor' | 'viewer' = 'editor'
): Promise<void> {
    const planRef = doc(db, 'plans', planId);
    const member: PlanMember = {
        uid: userId,
        email: userEmail,
        displayName,
        photoURL,
        role,
        joinedAt: Timestamp.now(),
    };

    await updateDoc(planRef, {
        [`members.${userId}`]: member,
        lastModified: Timestamp.now(),
    });

    // Notify the user they were added
    await sendAppNotification(
        userId,
        'Du har lagts till i en plan! 🤝',
        `Du är nu medlem i planen "${(await getDoc(planRef)).data()?.name}".`,
        'plan_update',
        planId
    );
}

export async function removeMemberFromPlan(planId: string, userId: string): Promise<void> {
    const planRef = doc(db, 'plans', planId);
    const planSnap = await getDoc(planRef);

    if (!planSnap.exists()) return;

    const plan = planSnap.data() as Plan;
    const updatedMembers = { ...plan.members };
    delete updatedMembers[userId];

    await updateDoc(planRef, {
        members: updatedMembers,
        lastModified: Timestamp.now(),
    });
}

export async function updateItemDeadline(
    planId: string,
    itemId: string,
    deadline: Timestamp | null
): Promise<void> {
    const planRef = doc(db, 'plans', planId);
    const planSnap = await getDoc(planRef);
    if (!planSnap.exists()) return;

    const plan = planSnap.data() as Plan;
    const updatedItems = plan.items.map(item =>
        item.id === itemId ? { ...item, deadline: deadline || undefined } : item
    );

    await updateDoc(planRef, {
        items: updatedItems,
        lastModified: Timestamp.now()
    });
}

export async function updateItemRecurring(
    planId: string,
    itemId: string,
    recurring: 'daily' | 'weekly' | 'monthly' | 'none'
): Promise<void> {
    const planRef = doc(db, 'plans', planId);
    const planSnap = await getDoc(planRef);
    if (!planSnap.exists()) return;

    const plan = planSnap.data() as Plan;
    const updatedItems = plan.items.map(item =>
        item.id === itemId ? { ...item, recurring: recurring === 'none' ? undefined : recurring } : item
    );

    await updateDoc(planRef, {
        items: updatedItems,
        lastModified: Timestamp.now()
    });
}

export async function toggleReaction(
    planId: string,
    itemId: string,
    userId: string,
    userName: string,
    emoji: string
): Promise<void> {
    const planRef = doc(db, 'plans', planId);
    const planSnap = await getDoc(planRef);

    if (!planSnap.exists()) return;

    const plan = planSnap.data() as Plan;
    const item = plan.items.find(i => i.id === itemId);
    if (!item) return;

    const reactions = item.reactions || [];
    const existingIndex = reactions.findIndex(r => r.userId === userId && r.emoji === emoji);

    let updatedReactions;
    if (existingIndex > -1) {
        // Remove reaction
        updatedReactions = reactions.filter((_, i) => i !== existingIndex);
    } else {
        // Add reaction
        updatedReactions = [...reactions, { userId, userName, emoji }];

        // Notify the person who checked/uploaded the item (if it's not the same person)
        const recipientId = item.checkedByUid || plan.ownerId;
        if (recipientId !== userId) {
            sendAppNotification(
                recipientId,
                `${userName} reagerade! ${emoji}`,
                `${userName} gav en reaktion på "${item.text}" i ${plan.name}`,
                'plan_update',
                planId
            );
        }
    }

    const updatedItems = plan.items.map(i =>
        i.id === itemId ? { ...i, reactions: updatedReactions } : i
    );

    await updateDoc(planRef, {
        items: updatedItems,
        lastModified: Timestamp.now()
    });
}

export async function toggleCommentLike(
    planId: string,
    itemId: string,
    commentId: string,
    userId: string
): Promise<void> {
    const planRef = doc(db, 'plans', planId);
    const planSnap = await getDoc(planRef);
    if (!planSnap.exists()) return;

    const plan = planSnap.data() as Plan;
    const updatedItems = plan.items.map(item => {
        if (item.id === itemId) {
            const updatedComments = item.comments?.map(comment => {
                if (comment.id === commentId) {
                    const likes = comment.likes || [];
                    const isLiked = likes.includes(userId);
                    return {
                        ...comment,
                        likes: isLiked ? likes.filter(id => id !== userId) : [...likes, userId]
                    };
                }
                return comment;
            });
            return { ...item, comments: updatedComments };
        }
        return item;
    });

    await updateDoc(planRef, {
        items: updatedItems,
        lastModified: Timestamp.now()
    });
}

export async function cleanupExpiredPlans(userId: string): Promise<void> {
    const plansRef = collection(db, 'plans');
    const q = query(
        plansRef,
        where(`members.${userId}`, '!=', null),
        where('completed', '==', true)
    );

    onSnapshot(q, async (snapshot) => {
        const now = Date.now();
        const thirtyDaysInMs = 30 * 24 * 60 * 60 * 1000;

        for (const doc of snapshot.docs) {
            const plan = doc.data() as Plan;
            if (plan.completedAt) {
                const completedTime = plan.completedAt.toMillis();
                if (now - completedTime > thirtyDaysInMs) {
                    await deleteDoc(doc.ref);
                    console.log(`Deleted expired plan: ${plan.name}`);
                }
            }
        }
    });

    // We only want to run this once, so we'll just let it run and not worry about unsubscribing 
    // since it's used at app level usually. 
}
