import { useState, useEffect } from 'react';
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
import type { Plan, PlanMember, Item } from '../types';

export function usePlans(userId: string | undefined) {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!userId) {
            setPlans([]);
            setLoading(false);
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
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!planId) {
            setPlan(null);
            setLoading(false);
            return;
        }

        const planRef = doc(db, 'plans', planId);

        const unsubscribe = onSnapshot(
            planRef,
            (snapshot) => {
                if (snapshot.exists()) {
                    const data = snapshot.data();
                    setPlan({
                        id: snapshot.id,
                        ...data,
                        items: data.items || [],
                        members: data.members || {},
                    } as Plan);
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
    }, [planId]);

    return { plan, loading, error };
}

// Plan CRUD operations
export async function createPlan(
    name: string,
    userId: string,
    userEmail: string,
    userName: string,
    userPhoto?: string,
    imageUrl?: string
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
        imageUrl
    };
    const docRef = await addDoc(plansRef, newPlan);
    return docRef.id;
}

export async function updatePlan(planId: string, updates: Partial<Plan>) {
    const planRef = doc(db, 'plans', planId);
    await updateDoc(planRef, {
        ...updates,
        lastModified: Timestamp.now(),
    });
}

export async function deletePlan(planId: string) {
    const planRef = doc(db, 'plans', planId);
    await deleteDoc(planRef);
}

export async function addItemToPlan(planId: string, text: string, imageUrl?: string): Promise<void> {
    const planRef = doc(db, 'plans', planId);
    const newItem: Item = {
        id: Math.random().toString(36).substring(2, 11),
        text,
        checked: false,
        imageUrl
    };
    await updateDoc(planRef, {
        items: arrayUnion(newItem),
        lastModified: Timestamp.now(),
        completed: false, // Reset completed if new item added
    });
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
        lastModified: Timestamp.now(),
    });
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
        lastModified: Timestamp.now(),
    });
}

export async function toggleItemChecked(
    planId: string,
    itemId: string,
    userId: string,
    displayName: string
): Promise<void> {
    const planRef = doc(db, 'plans', planId);
    const planSnap = await getDoc(planRef);

    if (!planSnap.exists()) return;

    const plan = planSnap.data() as Plan;
    const updatedItems = plan.items.map((item) => {
        if (item.id === itemId) {
            const newChecked = !item.checked;
            return {
                ...item,
                checked: newChecked,
                checkedBy: newChecked ? displayName : undefined,
                checkedByUid: newChecked ? userId : undefined,
            };
        }
        return item;
    });

    const allChecked = updatedItems.every((i) => i.checked);

    await updateDoc(planRef, {
        items: updatedItems,
        completed: allChecked,
        lastModified: Timestamp.now(),
    });
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
