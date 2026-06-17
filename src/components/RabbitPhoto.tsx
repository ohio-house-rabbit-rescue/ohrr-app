// Photo for an adoptable rabbit. When a listing has a photo (real Petfinder
// data) it shows it; otherwise — sample rabbits, or real listings with no image
// yet — it renders a friendly, on-brand placeholder tinted deterministically
// from the rabbit's name (so the same bunny always gets the same color).

export function RabbitPhoto({
  name,
  photo,
  className = '',
}: {
  name: string
  photo?: string
  className?: string
}) {
  if (photo) {
    return (
      <img
        src={photo}
        alt={name}
        loading="lazy"
        className={`h-full w-full object-cover ${className}`}
      />
    )
  }

  let hue = 0
  for (let i = 0; i < name.length; i++) hue = (hue * 31 + name.charCodeAt(i)) % 360
  const background = `linear-gradient(135deg, hsl(${hue} 68% 90%), hsl(${(hue + 38) % 360} 72% 82%))`

  return (
    <div
      className={`flex h-full w-full items-center justify-center ${className}`}
      style={{ background }}
      role="img"
      aria-label={`${name} (photo coming soon)`}
    >
      <span className="text-[2.75rem] leading-none drop-shadow-sm" aria-hidden>
        🐰
      </span>
    </div>
  )
}
