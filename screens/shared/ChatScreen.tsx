
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { auth, db } from '../../src/firebase.ts';
import { doc, getDoc, collection, addDoc, onSnapshot, query, orderBy, serverTimestamp, Timestamp } from 'firebase/firestore';

interface ChatMessage {
  id: string;
  text: string;
  senderId: string;
  senderRole: 'customer' | 'driver';
  createdAt: Timestamp | null;
}

interface OtherParty {
  name: string;
  photoURL: string;
}

const QUICK_MESSAGES = [
  "I'm on my way",
  "I've arrived",
  "Please wait 5 minutes",
  "Can you share location?",
];

const formatTime = (timestamp: Timestamp | null): string => {
  if (!timestamp) return '';
  const date = timestamp.toDate();
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const ChatScreen: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const tripId = (location.state as any)?.tripId as string | undefined;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [otherParty, setOtherParty] = useState<OtherParty>({ name: '', photoURL: '' });
  const [myRole, setMyRole] = useState<'customer' | 'driver'>('customer');
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const currentUid = auth.currentUser?.uid;

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Fetch trip data and other party info
  useEffect(() => {
    if (!tripId || !currentUid) return;

    const fetchTripAndParty = async () => {
      try {
        const tripSnap = await getDoc(doc(db, 'trips', tripId));
        if (!tripSnap.exists()) {
          setLoading(false);
          return;
        }

        const trip = tripSnap.data();
        const isCustomer = trip.customerId === currentUid;
        const role: 'customer' | 'driver' = isCustomer ? 'customer' : 'driver';
        setMyRole(role);

        const otherId = isCustomer ? trip.driverId : trip.customerId;
        if (otherId) {
          const userSnap = await getDoc(doc(db, 'users', otherId));
          if (userSnap.exists()) {
            const userData = userSnap.data();
            setOtherParty({
              name: userData.name || 'Unknown',
              photoURL: userData.photoURL || '',
            });
          }
        }
      } catch (err) {
        console.error('Error fetching trip/party info:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchTripAndParty();
  }, [tripId, currentUid]);

  // Real-time messages listener
  useEffect(() => {
    if (!tripId) return;

    const messagesRef = collection(db, 'trips', tripId, 'messages');
    const q = query(messagesRef, orderBy('createdAt', 'asc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: ChatMessage[] = snapshot.docs.map((d) => ({
        id: d.id,
        text: d.data().text,
        senderId: d.data().senderId,
        senderRole: d.data().senderRole,
        createdAt: d.data().createdAt,
      }));
      setMessages(msgs);
    });

    return () => unsubscribe();
  }, [tripId]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || !tripId || !currentUid) return;

    try {
      const messagesRef = collection(db, 'trips', tripId, 'messages');
      await addDoc(messagesRef, {
        text: text.trim(),
        senderId: currentUid,
        senderRole: myRole,
        createdAt: serverTimestamp(),
      });
      setInput('');
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  // No tripId — show fallback
  if (!tripId) {
    return (
      <div className="flex flex-col h-full bg-background-light dark:bg-background-dark items-center justify-center gap-4 p-6">
        <span className="material-symbols-outlined text-5xl text-slate-300">chat_bubble_outline</span>
        <p className="text-slate-500 text-center">No active trip</p>
        <button
          onClick={() => navigate(-1)}
          className="mt-2 px-6 py-2.5 bg-primary text-white rounded-xl font-semibold text-sm"
        >
          Go Back
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col h-full bg-background-light dark:bg-background-dark items-center justify-center">
        <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isMe = (msg: ChatMessage) => msg.senderId === currentUid;

  return (
    <div className="flex flex-col h-full bg-background-light dark:bg-background-dark">
      {/* Header */}
      <header className="bg-white dark:bg-background-dark border-b px-4 py-3 flex items-center gap-4 z-20">
        <button onClick={() => navigate(-1)} className="p-1">
          <span className="material-symbols-outlined">arrow_back</span>
        </button>
        <div className="flex flex-1 items-center gap-3">
          {otherParty.photoURL ? (
            <div
              className="size-10 rounded-full bg-cover bg-center border"
              style={{ backgroundImage: `url('${otherParty.photoURL}')` }}
            />
          ) : (
            <div className="size-10 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center border">
              <span className="material-symbols-outlined text-slate-400">person</span>
            </div>
          )}
          <div className="flex flex-col">
            <h2 className="text-base font-bold leading-tight">{otherParty.name || 'Loading...'}</h2>
            <span className="text-[10px] text-slate-500">
              {myRole === 'customer' ? 'Driver' : 'Customer'}
            </span>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollContainerRef} className="flex-1 overflow-y-auto no-scrollbar p-4 flex flex-col gap-6">
        {/* Today separator */}
        <div className="flex justify-center my-2">
          <span className="bg-slate-200 text-slate-600 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest">
            Today
          </span>
        </div>

        {messages.length === 0 && (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-slate-400 text-sm">No messages yet. Say hello!</p>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={`flex items-end gap-2 ${isMe(m) ? 'justify-end' : ''}`}>
            {!isMe(m) && (
              otherParty.photoURL ? (
                <div
                  className="size-8 rounded-full bg-slate-200 shrink-0 bg-cover bg-center"
                  style={{ backgroundImage: `url('${otherParty.photoURL}')` }}
                />
              ) : (
                <div className="size-8 rounded-full bg-slate-200 dark:bg-slate-700 shrink-0 flex items-center justify-center">
                  <span className="material-symbols-outlined text-sm text-slate-400">person</span>
                </div>
              )
            )}
            <div className={`flex flex-col gap-1 max-w-[75%] ${isMe(m) ? 'items-end' : 'items-start'}`}>
              <div
                className={`px-4 py-3 rounded-2xl shadow-sm ${
                  isMe(m)
                    ? 'bg-primary text-white rounded-br-sm'
                    : 'bg-white dark:bg-slate-800 rounded-bl-sm border'
                }`}
              >
                <p className="text-sm leading-relaxed">{m.text}</p>
              </div>
              <div className="flex items-center gap-1 mt-1">
                <span className="text-[9px] text-slate-400">{formatTime(m.createdAt)}</span>
              </div>
            </div>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Footer */}
      <footer className="bg-white dark:bg-slate-900 border-t p-3 pb-8 flex flex-col gap-3">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {QUICK_MESSAGES.map((chip) => (
            <button
              key={chip}
              onClick={() => sendMessage(chip)}
              className="whitespace-nowrap rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] font-semibold text-slate-600"
            >
              {chip}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage(input)}
              className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary/20"
              placeholder="Type a message..."
            />
          </div>
          <button
            onClick={() => sendMessage(input)}
            className="size-11 rounded-xl bg-primary text-white flex items-center justify-center shadow-lg shadow-blue-500/30"
          >
            <span className="material-symbols-outlined">send</span>
          </button>
        </div>
      </footer>
    </div>
  );
};

export default ChatScreen;
