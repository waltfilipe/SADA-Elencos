import { profileTone } from "@/lib/scoutUi";
import type { PlayerProfile } from "@/lib/types";

type Props = {
  profile: string;
  hybridLean?: string | null;
  className?: string;
};

export function ProfileTag({ profile, hybridLean, className = "" }: Props) {
  return (
    <span className={`profile-tag profile-${profileTone(profile)} ${className}`.trim()}>
      {profile}
      {hybridLean ? <span className="profile-lean">{hybridLean}</span> : null}
    </span>
  );
}

export function profileTagProps(player: Pick<PlayerProfile, "profile" | "hybrid_lean">) {
  return {
    profile: player.profile,
    hybridLean: player.hybrid_lean ?? null,
  };
}
