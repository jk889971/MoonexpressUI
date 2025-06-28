"use client"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import useSWR from "swr"
import { fetcher } from "@/lib/fetcher";
import { useAccount } from 'wagmi'
import { useChain } from '@/hooks/useChain'

type Comment = {
  id: string
  text: string
  createdAt: number
  parentId?: string | null
  replies: Comment[]
  profile: { avatarIndex: number }
}

interface DiscussionPanelProps {
  commentText: string
  setCommentText: React.Dispatch<React.SetStateAction<string>>
  replyToId: string | null
  setReplyToId: (id: string | null) => void
  replyText: string
  setReplyText: (val: string) => void
  textareaRef: React.RefObject<HTMLTextAreaElement>
}

export default function DiscussionPanel({
  description,
  tokenName,
  tokenSymbol,
  launchAddress,
  commentText,
  setCommentText,
  replyToId,
  setReplyToId,
  replyText,
  setReplyText,
  textareaRef,
}: Omit<DiscussionPanelProps, "comments" | "setComments"> & {
    description: string
    launchAddress: `0x${string}`
    tokenName?: string | undefined
    tokenSymbol?: string | undefined
  }) {

  const { address, isConnected } = useAccount()

  const [CHAIN] = useChain()
  
  const {
    data: flat = [],  
    mutate,           
  } = useSWR<Comment[]>(
    () => `/api/comments/${launchAddress}?chain=${CHAIN.key}`,
    fetcher
  );

  function nest(list: Comment[], parentId: string | null = null): Comment[] {
    return list
      .filter(c => c.parentId === parentId)
      .map(c => ({
        ...c,
        replies: nest(list, c.id)
      }));
  }

  const comments = nest(flat);

  async function handlePostReply(parentId: string) {
    if (replyText.trim() === "") return
    await fetch(`/api/comments/${launchAddress}?chain=${CHAIN.key}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: replyText.trim(),
        parentId,
        wallet: address,
      }),
    });
    mutate();
    setReplyToId(null)
    setReplyText("")
  }

  function shortAddr(addr: string) {
    return addr.slice(0, 6) + '...' + addr.slice(-3)
  }

  function formatUTC(ts: number) {
    const iso = new Date(ts).toISOString()   
    const [date, rest] = iso.split("T")      
    const time = rest.slice(0, 8)            
    return date + "\u00A0\u00A0\u00A0" + time + " UTC"
  }

  return (
    <div>
      <h2 className="text-[#c8cdd1] text-lg font-semibold max-[480px]:font-bold mb-2 max-[480px]:text-[clamp(1rem,3.5vw,1.5rem)]">
        {tokenName ?? "Token"} ({tokenSymbol ?? "Symbol"})
      </h2>
      <p className="text-[#c8cdd1] text-sm leading-relaxed mb-4 text-[clamp(0.6rem,3vw,0.875rem)]">
        {description || "No description."}
      </p>
      <div className="relative pt-2 w-full">
        <textarea
          disabled={!isConnected}
          ref={textareaRef}
          value={commentText}
          onChange={(e) => setCommentText(e.target.value)}
          maxLength={250}
          rows={1}
          className="
            disabled:opacity-50 disabled:cursor-not-allowed
            theme-textarea
            w-full
            bg-[#0e1a38]
            border border-[#21325e]
            rounded-md
            px-3 py-2
            text-white
            placeholder:text-gray-400
            focus:outline-none focus:ring-2 focus:ring-[#19c0f4]
            resize-none
            text-sm
            overflow-hidden
            scrollbar-thin scrollbar-thumb-[#19c0f4]/60 scrollbar-track-[#21325e]
            max-h-[4.5rem]
            leading-6
          "
          placeholder={
            isConnected
              ? "Enter Comment"
              : "Connect Wallet to comment"
          }
        />
      </div>
      <span className="block text-left text-xs text-white/50 ml-1">
        {commentText.length}/250
      </span>

      <div className="flex justify-end pb-4 w-full">
        <Button
          disabled={!isConnected || commentText.trim() === '' }
          onClick={async () => {
            if (commentText.trim() === "") return
            await fetch(`/api/comments/${launchAddress}?chain=${CHAIN.key}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                text: commentText.trim(),
                wallet: address,
              }),
            });
            setCommentText("");
            mutate();                 
          }}
          size="sm"
          variant="outline"
          className="
            bg-transparent border-[#19c0f4] text-[#19c0f4]
            hover:bg-[#19c0f4] hover:text-white hover:border-[#19c0f4]
            font-normal rounded-md px-4 py-2 text-sm
          "
        >
          Comment
        </Button>
      </div>

      <div
        className="theme-textarea overflow-y-auto overflow-x-hidden space-y-4 px-2 scrollbar-thin scrollbar-thumb-[#19c0f4]/60 scrollbar-track-[#21325e] max-h-[36rem]"
      >
        {comments.length === 0 ? (
          <p className="text-[#c8cdd1] text-sm text-center">
            No comments yet.
          </p>
        ) : (
          comments.map((c) => (
            <div key={c.id} className="space-y-2">
              <div className="flex gap-3 w-full">
                <Avatar className="w-8 h-8 flex-shrink-0">
                  <AvatarImage src={`/avatars/${c.profile.avatarIndex}.png?height=32&width=32`} />
                  <AvatarFallback className="bg-[#565656]">U</AvatarFallback>
                </Avatar>
                <div className="flex-1 pr-4">
                  <div className="flex flex-col gap-1 lg:flex-row lg:items-center justify-between">
                    <span className="text-white font-semibold text-sm">
                      {shortAddr(c.wallet)}
                    </span>
                    <span className="text-[#c8cdd1] text-xs text-[clamp(0.5rem,2vw,0.75rem)]">
                      {formatUTC(c.createdAt)}
                    </span>
                  </div>
                  <p className="text-[#c8cdd1] text-sm mt-1 break-all text-[clamp(0.65rem,2.5vw,1rem)]">
                    {c.text}
                  </p>
                  <button
                    onClick={() => {
                      setReplyToId(c.id)
                      setReplyText("")
                    }}
                    className="mt-1 text-[#19c0f4] text-xs hover:text-white"
                  >
                    Reply
                  </button>
                </div>
              </div>

              {replyToId === c.id && (
                <div className="ml-10 mt-2 pr-4 pt-1 pl-1 max-w-full overflow-x-hidden">
                  <textarea
                    disabled={!isConnected}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    rows={1}
                    maxLength={250}
                    className="
                      disabled:opacity-50 disabled:cursor-not-allowed
                      theme-textarea
                      w-full
                      max-w-full
                      bg-[#0e1a38]
                      border border-[#21325e]
                      rounded-md
                      px-3 py-2
                      text-white
                      placeholder:text-gray-400
                      focus:outline-none focus:ring-2 focus:ring-[#19c0f4]
                      resize-none
                      text-sm
                      overflow-y-auto
                      scrollbar-thin scrollbar-thumb-[#19c0f4]/60 scrollbar-track-[#21325e]
                      max-h-[4.5rem]
                      leading-6
                    "
                    placeholder={
                      isConnected
                        ? "Enter Reply"
                        : "Connect Wallet to reply"
                    }
                  />
                  <span className="block text-left text-xs text-white/50">
                    {replyText.length}/250
                  </span>
                  <div className="flex justify-end">
                    <Button
                      disabled={!isConnected || replyText.trim() === ''}
                      onClick={() => handlePostReply(c.id)}
                      size="sm"
                      variant="outline"
                      className="
                        text-[#19c0f4] bg-transparent border-[#19c0f4]
                        hover:bg-[#19c0f4] hover:text-white hover:border-[#19c0f4]
                        rounded-md px-3 py-1 text-xs mb-4
                      "
                    >
                      Reply
                    </Button>
                  </div>
                </div>
              )}

              {c.replies.length > 0 && (
                <div className="ml-10 space-y-4 mt-4 w-full">
                  {c.replies.map((r) => (
                    <div key={r.id} className="flex gap-3 w-full">
                      <Avatar className="w-8 h-8 flex-shrink-0">
                        <AvatarImage src={`/avatars/${r.profile.avatarIndex}.png?height=32&width=32`} />
                        <AvatarFallback className="bg-[#565656]">U</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 pr-16">
                        <div className="flex flex-col gap-1 lg:flex-row lg:items-center justify-between">
                          <span className="text-white font-semibold text-sm text-[clamp(0.65rem,2.5vw,1rem)]">
                            {shortAddr(r.wallet)}
                          </span>
                          <span className="text-[#c8cdd1] text-xs text-[clamp(0.5rem,2vw,0.75rem)]">
                            {formatUTC(r.createdAt)}
                          </span>
                        </div>
                        <p className="text-[#c8cdd1] text-sm mt-1 break-all text-[clamp(0.5rem,2vw,0.75rem)]">
                          {r.text}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}