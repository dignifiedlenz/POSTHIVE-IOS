import {createClient} from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {SUPABASE_URL, SUPABASE_ANON_KEY} from '@env';

const supabaseUrl = SUPABASE_URL;
const supabaseAnonKey = SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export const getCurrentUser = async () => {
  const {
    data: {user},
    error,
  } = await supabase.auth.getUser();
  if (error) {
    throw error;
  }
  return user;
};

export const signIn = async (email: string, password: string) => {
  const {data, error} = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) {
    throw error;
  }
  return data;
};

export const signOut = async () => {
  const {error} = await supabase.auth.signOut();
  if (error) {
    throw error;
  }
};

export const getSession = async () => {
  const {data, error} = await supabase.auth.getSession();
  if (error) {
    throw error;
  }
  return data.session;
};

