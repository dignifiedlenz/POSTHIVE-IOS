'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { ProjectDeliverableCard } from './ProjectDeliverableCard';
import { getEnhancedDeliverablesByProject, getDeliverableStats } from '@/lib/actions/deliverable';
import { EnhancedDeliverable } from '@/lib/types';
import { createClient } from '@/lib/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { Share, X, Copy, Lock, Check, Users, UserCheck, ChevronLeft } from 'lucide-react';
import { cn } from '@/lib/utils';
import { buttonVariants, borders, backgrounds, input } from '@/lib/styles/drive-design';

interface DeliverablesHorizontalScrollProps {
  projectId: string;
  workspaceSlug: string;
  currentDeliverableId?: string;
  onDeliverableChange?: (deliverableId: string) => void;
  isVisible?: boolean;
}

export function DeliverablesHorizontalScroll({
  projectId,
  workspaceSlug,
  currentDeliverableId,
  onDeliverableChange,
  isVisible: externalIsVisible = true
}: DeliverablesHorizontalScrollProps) {
  const [deliverables, setDeliverables] = useState<EnhancedDeliverable[]>([]);
  const [deliverableStats, setDeliverableStats] = useState<Record<string, { commentCount: number; unreadCommentCount?: number }>>({});
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [isAnimatingIn, setIsAnimatingIn] = useState(false);
  const [shouldRender, setShouldRender] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Share flow state
  const [showShareFlow, setShowShareFlow] = useState(false);
  const [selectedDeliverable, setSelectedDeliverable] = useState<EnhancedDeliverable | null>(null);
  const [shareFlowStep, setShareFlowStep] = useState<'select' | 'expiration' | 'downloads' | 'password' | 'complete'>('select');
  const [shareRecipientType, setShareRecipientType] = useState<'client' | 'teammate' | null>(null);
  const [shareExpiresInDays, setShareExpiresInDays] = useState(30);
  const [allowDownloads, setAllowDownloads] = useState(true);
  const [sharePassword, setSharePassword] = useState('');
  const [usePassword, setUsePassword] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [isCreatingShare, setIsCreatingShare] = useState(false);
  const [shareCreated, setShareCreated] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Handle horizontal scroll - support both trackpad horizontal swipe and vertical-to-horizontal conversion
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      // If there's horizontal delta (trackpad horizontal swipe), let it work natively
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        return; // Let native horizontal scroll work
      }
      
      // Convert vertical scroll to horizontal
      if (e.deltaY !== 0 && container.scrollWidth > container.clientWidth) {
        e.preventDefault();
        container.scrollLeft += e.deltaY;
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [shouldRender]);

  // Handle visibility changes with animations
  useEffect(() => {
    if (externalIsVisible) {
      // Show: render first, then animate in
      setShouldRender(true);
      setTimeout(() => setIsAnimatingIn(true), 10);
    } else {
      // Hide: animate out first, then remove from DOM
      setIsAnimatingIn(false);
      const timer = setTimeout(() => {
        setShouldRender(false);
      }, 700); // Match duration-700
      return () => clearTimeout(timer);
    }
  }, [externalIsVisible]);

  const formatDeliverableDeadline = (date?: string | null) => {
    if (!date || !mounted) return 'NO DEADLINE';
    try {
      return formatDistanceToNow(new Date(date), { addSuffix: true });
    } catch {
      return 'recently';
    }
  };

  const formatTimeUntilDeadline = (dueDate?: string | null, version?: string): string => {
    if (!dueDate) return 'NO DEADLINE';
    
    // Don't show overdue for FINAL versions
    if (version === 'FINAL') {
      return 'FINAL';
    }
    
    const now = new Date();
    const due = new Date(dueDate);
    const diffMs = due.getTime() - now.getTime();
    
    if (diffMs < 0) return 'OVERDUE';
    
    const diffMinutes = Math.round(diffMs / 60000);
    if (diffMinutes < 60) return `${diffMinutes}M`;
    
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}H`;
    
    const diffDays = Math.ceil(diffMinutes / (24 * 60));
    if (diffDays === 1) return '1D';
    return `${diffDays}D`;
  };

  const loadDeliverableStats = async (deliverablesList: EnhancedDeliverable[]) => {
    if (deliverablesList.length === 0) return;

    try {
      const supabase = createClient();
      const deliverableIds = deliverablesList.map(d => d.id);
      const { data: batchStatsData, error: statsError } = await supabase
        .rpc('get_deliverable_stats_batch', { deliverable_ids: deliverableIds });
      
      // Fetch unread comment counts for all deliverables
      const unreadCountPromises = deliverableIds.map(async (deliverableId) => {
        try {
          const response = await fetch(`/api/deliverables/${deliverableId}/unread-comments`);
          if (response.ok) {
            const data = await response.json();
            return { deliverableId, unreadCount: data.unreadCount || 0 };
          }
        } catch (error) {
          console.error(`Error fetching unread count for ${deliverableId}:`, error);
        }
        return { deliverableId, unreadCount: 0 };
      });
      
      const unreadCounts = await Promise.all(unreadCountPromises);
      const unreadCountMap = unreadCounts.reduce((acc, { deliverableId, unreadCount }) => {
        acc[deliverableId] = unreadCount;
        return acc;
      }, {} as Record<string, number>);
      
      if (statsError) {
        console.warn('Batch stats failed, falling back to individual calls:', statsError);
        const statsPromises = deliverablesList.map(async (deliverable) => {
          const stats = await getDeliverableStats(deliverable.id);
          return { id: deliverable.id, stats };
        });
        
        const statsResults = await Promise.all(statsPromises);
        const statsMap = statsResults.reduce((acc, { id, stats }) => {
          acc[id] = { 
            commentCount: stats.commentCount,
            unreadCommentCount: unreadCountMap[id] || 0
          };
          return acc;
        }, {} as Record<string, { commentCount: number; unreadCommentCount?: number }>);
        
        setDeliverableStats(statsMap);
      } else {
        const statsMap = batchStatsData?.reduce((acc: any, stat: any) => {
          acc[stat.deliverable_id] = {
            commentCount: stat.comment_count,
            unreadCommentCount: unreadCountMap[stat.deliverable_id] || 0
          };
          return acc;
        }, {} as Record<string, { commentCount: number; unreadCommentCount?: number }>) || {};
        
        setDeliverableStats(statsMap);
      }
    } catch (error) {
      console.error('Error loading deliverable stats:', error);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const projectDeliverables = await getEnhancedDeliverablesByProject(projectId);
        setDeliverables(projectDeliverables);
        await loadDeliverableStats(projectDeliverables);
      } catch (error) {
        console.error('Error loading deliverables:', error);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [projectId]);

  // Share flow handlers
  const handleShareClick = (deliverable: EnhancedDeliverable) => {
    setSelectedDeliverable(deliverable);
    setShowShareFlow(true);
    setShareFlowStep('select');
    setShareRecipientType(null);
    setShareExpiresInDays(30);
    setAllowDownloads(true);
    setSharePassword('');
    setUsePassword(false);
    setShareLink(null);
    setShareCreated(false);
  };

  const handleRecipientSelect = (type: 'client' | 'teammate') => {
    setShareRecipientType(type);
    if (type === 'teammate') {
      // For teammate, just copy the URL
      const baseUrl = typeof window !== 'undefined' 
        ? (process.env.NEXT_PUBLIC_APP_URL || window.location.origin)
        : process.env.NEXT_PUBLIC_APP_URL || '';
      const deliverableLink = selectedDeliverable?.type === 'image_gallery'
        ? `${baseUrl}/${workspaceSlug}/projects/${projectId}/deliverables/${selectedDeliverable?.id}/gallery`
        : `${baseUrl}/${workspaceSlug}/projects/${projectId}/deliverables/${selectedDeliverable?.id}`;
      
      if (typeof window !== 'undefined' && navigator.clipboard) {
        navigator.clipboard.writeText(deliverableLink);
      }
      setShareLink(deliverableLink);
      setShareCreated(true);
      setShareFlowStep('complete');
    } else {
      // For client, go to expiration step
      setShareFlowStep('expiration');
    }
  };

  const handleNextStep = () => {
    if (shareFlowStep === 'expiration') {
      setShareFlowStep('downloads');
    } else if (shareFlowStep === 'downloads') {
      setShareFlowStep('password');
    }
  };

  const handleBackStep = () => {
    if (shareFlowStep === 'password') {
      setShareFlowStep('downloads');
    } else if (shareFlowStep === 'downloads') {
      setShareFlowStep('expiration');
    } else if (shareFlowStep === 'expiration') {
      setShareFlowStep('select');
    }
  };

  const createClientReviewLink = async () => {
    if (!selectedDeliverable) return;

    try {
      setIsCreatingShare(true);
      
      // Get version number from deliverable
      const versionNumber = selectedDeliverable.version === 'FINAL' 
        ? 100 
        : parseInt(selectedDeliverable.version.replace('V', ''), 10) || 1;
      
      const response = await fetch('/api/client-review/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deliverableId: selectedDeliverable.id,
          versionNumber,
          expiresInDays: shareExpiresInDays,
          password: usePassword ? sharePassword : null,
          allowDownloads: allowDownloads
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create share link');
      }
      
      setShareLink(data.link.url);
      setShareCreated(true);
      setShareFlowStep('complete');
      
    } catch (error) {
      console.error('Error creating client review link:', error);
      alert(error instanceof Error ? error.message : 'Failed to create share link');
    } finally {
      setIsCreatingShare(false);
    }
  };

  const copyShareLink = async () => {
    if (shareLink && typeof window !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(shareLink);
      // Could add toast notification here
    }
  };

  const resetShareFlow = () => {
    setShowShareFlow(false);
    setSelectedDeliverable(null);
    setShareFlowStep('select');
    setShareRecipientType(null);
    setShareExpiresInDays(30);
    setAllowDownloads(true);
    setSharePassword('');
    setUsePassword(false);
    setShareLink(null);
    setShareCreated(false);
    setIsCreatingShare(false);
  };

  if ((deliverables.length === 0 && !loading) || !shouldRender) {
    return null;
  }

  return (
    <div 
      className={`fixed bottom-0 left-0 right-0 h-[32vh] px-10 pb-6 z-40 transition-all duration-700 ease-out pointer-events-auto ${
        isAnimatingIn ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
      }`}
      style={{
        background: 'linear-gradient(to top, rgba(0,0,0,0.98) 0%, rgba(0,0,0,0.90) 25%, rgba(0,0,0,0.75) 50%, rgba(0,0,0,0.50) 75%, transparent 100%)'
      }}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-[0.35em] text-white/60">Deliverables</p>
            <div className="mt-2 h-px w-16 bg-white/20" />
          </div>
          <p className="text-[10px] uppercase tracking-[0.35em] text-white/50">
            {deliverables.length.toString().padStart(2, '0')} TOTAL
          </p>
        </div>
        <div
          ref={scrollContainerRef}
          className="mt-4 flex-1 overflow-x-auto overflow-y-hidden scrollbar-hide"
        >
          {loading ? (
            <div className="flex h-full min-w-max gap-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={`deliverable-skeleton-${index}`}
                  className="h-40 w-72 flex-shrink-0 border border-white/12 bg-black/40"
                >
                  <div className="h-full w-full bg-gradient-to-b from-white/5 to-white/[0.02] animate-pulse" />
                </div>
              ))}
            </div>
          ) : (
            <div className="flex min-w-max gap-4">
              {[...deliverables]
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .map((deliverable, index) => {
                  const baseStats = deliverableStats[deliverable.id] || { commentCount: 0 };
                  const stats = {
                    ...baseStats,
                    // Include gallery-specific counts from the deliverable
                    photoCount: deliverable.photo_count || 0,
                    videoCount: deliverable.video_count || 0
                  };
                  const deadlineLabel = formatDeliverableDeadline((deliverable as any).due_date);
                  const timeUntilDeadline = formatTimeUntilDeadline((deliverable as any).due_date, deliverable.version);
                  const isActive = deliverable.id === currentDeliverableId;
                  
                  return (
                    <div
                      key={deliverable.id}
                      className={`flex-shrink-0 w-72 transition-all duration-500 ease-out ${isActive ? 'ring-2 ring-white' : ''}`}
                      style={{
                        opacity: isAnimatingIn ? 1 : 0,
                        transform: isAnimatingIn ? 'translateY(0)' : 'translateY(30px)',
                        transitionDelay: isAnimatingIn ? `${index * 50}ms` : `${(deliverables.length - index - 1) * 30}ms`
                      }}
                    >
                      <div className="relative group">
                        <ProjectDeliverableCard
                          deliverable={deliverable}
                          projectId={projectId}
                          workspaceSlug={workspaceSlug}
                          stats={stats}
                          deadlineLabel={deadlineLabel}
                          timeUntilDeadline={timeUntilDeadline}
                        />
                        {/* Share button overlay - appears on hover */}
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleShareClick(deliverable);
                          }}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-[50] p-2 bg-black/90 border border-white/20 hover:border-white/40 hover:bg-black rounded cursor-pointer pointer-events-auto"
                          title="Share review link"
                          style={{ pointerEvents: 'auto' }}
                        >
                          <Share className="w-4 h-4 text-white" />
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      {/* Share Flow Modal */}
      {showShareFlow && selectedDeliverable && (
        <ShareFlowModal
          deliverable={selectedDeliverable}
          step={shareFlowStep}
          recipientType={shareRecipientType}
          expiresInDays={shareExpiresInDays}
          setExpiresInDays={setShareExpiresInDays}
          allowDownloads={allowDownloads}
          setAllowDownloads={setAllowDownloads}
          usePassword={usePassword}
          setUsePassword={setUsePassword}
          password={sharePassword}
          setPassword={setSharePassword}
          shareLink={shareLink}
          shareCreated={shareCreated}
          isCreatingShare={isCreatingShare}
          onRecipientSelect={handleRecipientSelect}
          onNext={handleNextStep}
          onBack={handleBackStep}
          onCreateLink={createClientReviewLink}
          onCopyLink={copyShareLink}
          onClose={resetShareFlow}
        />
      )}
    </div>
  );
}

// ===== SHARE FLOW MODAL COMPONENT =====

interface ShareFlowModalProps {
  deliverable: EnhancedDeliverable;
  step: 'select' | 'expiration' | 'downloads' | 'password' | 'complete';
  recipientType: 'client' | 'teammate' | null;
  expiresInDays: number;
  setExpiresInDays: (days: number) => void;
  allowDownloads: boolean;
  setAllowDownloads: (allow: boolean) => void;
  usePassword: boolean;
  setUsePassword: (use: boolean) => void;
  password: string;
  setPassword: (password: string) => void;
  shareLink: string | null;
  shareCreated: boolean;
  isCreatingShare: boolean;
  onRecipientSelect: (type: 'client' | 'teammate') => void;
  onNext: () => void;
  onBack: () => void;
  onCreateLink: () => void;
  onCopyLink: () => void;
  onClose: () => void;
}

function ShareFlowModal({
  deliverable,
  step,
  recipientType,
  expiresInDays,
  setExpiresInDays,
  allowDownloads,
  setAllowDownloads,
  usePassword,
  setUsePassword,
  password,
  setPassword,
  shareLink,
  shareCreated,
  isCreatingShare,
  onRecipientSelect,
  onNext,
  onBack,
  onCreateLink,
  onCopyLink,
  onClose,
}: ShareFlowModalProps) {
  const formatVersionDisplay = (version?: string) => {
    if (!version) return '';
    return version === 'FINAL' ? 'FINAL' : version;
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center">
      <div className={cn(`bg-zinc-950 p-6 w-full max-w-lg mx-4`, borders.default)}>
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            {step !== 'select' && (
              <button
                onClick={onBack}
                className="text-zinc-400 hover:text-white transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
            )}
            <h3 className="text-xl font-bold text-white">
              {step === 'select' && 'Share Review Link'}
              {step === 'expiration' && 'Set Expiration'}
              {step === 'downloads' && 'Download Settings'}
              {step === 'password' && 'Password Protection'}
              {step === 'complete' && 'Link Ready'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step 1: Select Recipient Type */}
        {step === 'select' && (
          <div className="space-y-6">
            <p className="text-zinc-300">
              Choose who you want to share <strong>{deliverable.name}</strong> {formatVersionDisplay(deliverable.version)} with.
            </p>
            
            <div className="space-y-3">
              <button
                onClick={() => onRecipientSelect('client')}
                className={cn(
                  'w-full p-4 border-2 transition-all text-left',
                  borders.default,
                  'hover:border-white/40 hover:bg-white/[0.03]'
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-blue-600/20 border border-blue-600/30">
                    <UserCheck className="w-5 h-5 text-blue-400" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-white font-semibold mb-1">Client Review Link</h4>
                    <p className="text-sm text-zinc-400">
                      Create a secure, password-protected link with expiration and download controls
                    </p>
                  </div>
                </div>
              </button>

              <button
                onClick={() => onRecipientSelect('teammate')}
                className={cn(
                  'w-full p-4 border-2 transition-all text-left',
                  borders.default,
                  'hover:border-white/40 hover:bg-white/[0.03]'
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-green-600/20 border border-green-600/30">
                    <Users className="w-5 h-5 text-green-400" />
                  </div>
                  <div className="flex-1">
                    <h4 className="text-white font-semibold mb-1">Teammate Link</h4>
                    <p className="text-sm text-zinc-400">
                      Copy the direct link to share with your team members
                    </p>
                  </div>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Expiration (Client only) */}
        {step === 'expiration' && (
          <div className="space-y-6">
            <p className="text-zinc-300">
              When should the client review link expire?
            </p>

            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">
                Link expires in (days)
              </label>
              <select
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(parseInt(e.target.value))}
                className={cn(input, `w-full px-3 py-2`)}
              >
                <option value={7}>7 days</option>
                <option value={14}>14 days</option>
                <option value={30}>30 days</option>
                <option value={60}>60 days</option>
                <option value={90}>90 days</option>
              </select>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={onBack}
                className={cn(buttonVariants.secondary, 'flex-1')}
              >
                Back
              </button>
              <button
                onClick={onNext}
                className={cn(buttonVariants.primary, 'flex-1')}
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Downloads (Client only) */}
        {step === 'downloads' && (
          <div className="space-y-6">
            <p className="text-zinc-300">
              Should clients be able to download the video?
            </p>

            <div>
              <label className="flex items-center justify-between p-4 border border-white/12 hover:border-white/30 transition-colors cursor-pointer">
                <div>
                  <span className="text-sm font-medium text-zinc-300 block mb-1">
                    Allow Downloads
                  </span>
                  <p className="text-xs text-zinc-500">
                    Clients can download the video file
                  </p>
                </div>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={allowDownloads}
                    onChange={(e) => setAllowDownloads(e.target.checked)}
                    className="sr-only"
                  />
                  <div
                    onClick={() => setAllowDownloads(!allowDownloads)}
                    className={`w-12 h-6 rounded-full cursor-pointer transition-colors ${
                      allowDownloads ? 'bg-blue-600' : 'bg-zinc-600'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 bg-white rounded-full transition-transform mt-0.5 ${
                        allowDownloads ? 'translate-x-6' : 'translate-x-0.5'
                      }`}
                    />
                  </div>
                </div>
              </label>
            </div>

            <div className="flex space-x-3">
              <button
                onClick={onBack}
                className={cn(buttonVariants.secondary, 'flex-1')}
              >
                Back
              </button>
              <button
                onClick={onNext}
                className={cn(buttonVariants.primary, 'flex-1')}
              >
                Next
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Password (Client only) */}
        {step === 'password' && (
          <div className="space-y-6">
            <p className="text-zinc-300">
              Add password protection for extra security?
            </p>

            <div>
              <label className="flex items-center justify-between p-4 border border-white/12 hover:border-white/30 transition-colors cursor-pointer mb-4">
                <div>
                  <span className="text-sm font-medium text-zinc-300 block mb-1">
                    Use Password
                  </span>
                  <p className="text-xs text-zinc-500">
                    Require a password to access the review link
                  </p>
                </div>
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={usePassword}
                    onChange={(e) => setUsePassword(e.target.checked)}
                    className="sr-only"
                  />
                  <div
                    onClick={() => setUsePassword(!usePassword)}
                    className={`w-12 h-6 rounded-full cursor-pointer transition-colors ${
                      usePassword ? 'bg-blue-600' : 'bg-zinc-600'
                    }`}
                  >
                    <div
                      className={`w-5 h-5 bg-white rounded-full transition-transform mt-0.5 ${
                        usePassword ? 'translate-x-6' : 'translate-x-0.5'
                      }`}
                    />
                  </div>
                </div>
              </label>

              {usePassword && (
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      placeholder="Enter password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className={cn(input, `w-full px-3 py-2 pr-10`)}
                    />
                    {password && (
                      <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">
                    Clients will need this password to access the review link
                  </p>
                </div>
              )}
            </div>

            <div className="flex space-x-3">
              <button
                onClick={onBack}
                className={cn(buttonVariants.secondary, 'flex-1')}
              >
                Back
              </button>
              <button
                onClick={onCreateLink}
                disabled={isCreatingShare || (usePassword && !password)}
                className={cn(
                  buttonVariants.primary,
                  'flex-1',
                  (isCreatingShare || (usePassword && !password)) && buttonVariants.disabled
                )}
              >
                {isCreatingShare ? 'Creating...' : 'Create Link'}
              </button>
            </div>
          </div>
        )}

        {/* Step 5: Complete */}
        {step === 'complete' && (
          <div className="space-y-6">
            <div className="text-center">
              <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check className="w-6 h-6 text-white" />
              </div>
              <h4 className="text-lg font-semibold text-white mb-2">
                {recipientType === 'teammate' ? 'Link Copied!' : 'Share Link Created!'}
              </h4>
              <p className="text-zinc-400">
                {recipientType === 'teammate' 
                  ? 'The link has been copied to your clipboard'
                  : `Your client can now review ${deliverable.name} ${formatVersionDisplay(deliverable.version)}`
                }
              </p>
            </div>

            {shareLink && (
              <div className={cn(`p-4`, borders.default, backgrounds.default)}>
                <label className="block text-sm font-medium text-zinc-300 mb-2">
                  {recipientType === 'teammate' ? 'Review Link' : 'Client Review Link'}
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={shareLink}
                    readOnly
                    className={cn(input, `flex-1 px-3 py-2 text-sm font-mono`)}
                  />
                  <button
                    onClick={onCopyLink}
                    className={cn(buttonVariants.icon)}
                    title="Copy link"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {recipientType === 'client' && (
              <div className={cn(`p-4`, `border border-blue-600/30 bg-blue-900/20`)}>
                <h5 className="font-medium text-blue-300 mb-2">What your client will see:</h5>
                <ul className="text-sm text-blue-200 space-y-1">
                  <li>• The video for {formatVersionDisplay(deliverable.version)}</li>
                  <li>• Ability to leave timestamped comments</li>
                  <li>• All existing comments from your team</li>
                  {allowDownloads && <li>• Download button to save the video</li>}
                  <li>• Clean interface without project navigation</li>
                </ul>
              </div>
            )}

            <div className="flex space-x-3">
              {recipientType === 'client' && shareLink && (
                <button
                  onClick={() => window.open(`mailto:?subject=Review: ${deliverable.name}&body=Hi! Please review ${deliverable.name} ${formatVersionDisplay(deliverable.version)} using this link: ${shareLink}`, '_blank')}
                  className={cn(buttonVariants.secondary, 'flex-1')}
                >
                  Send via Email
                </button>
              )}
              <button
                onClick={onClose}
                className={cn(buttonVariants.primary, 'flex-1')}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
