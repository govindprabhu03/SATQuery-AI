import { useEffect, useRef } from 'react'

export default function SpaceBackground() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    let animationId
    let stars = []

    function resize() {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      const count = Math.floor((canvas.width * canvas.height) / 2200)
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.3 + 0.2,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.015 + 0.005,
        drift: Math.random() * 0.15 + 0.02,
      }))
    }

    function draw(t) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (const s of stars) {
        const twinkle = 0.5 + 0.5 * Math.sin(t * s.speed + s.phase)
        ctx.globalAlpha = 0.25 + twinkle * 0.75
        ctx.fillStyle = '#e6ecff'
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fill()
        s.y += s.drift * 0.05
        if (s.y > canvas.height) s.y = 0
      }
      ctx.globalAlpha = 1
      animationId = requestAnimationFrame(draw)
    }

    resize()
    window.addEventListener('resize', resize)
    animationId = requestAnimationFrame(draw)

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(animationId)
    }
  }, [])

  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-[#03040a]">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,rgba(76,29,149,0.35),transparent),radial-gradient(ellipse_60%_40%_at_90%_100%,rgba(14,116,144,0.25),transparent)]" />
      <div
        className="absolute -bottom-[55vw] -left-[25vw] h-[110vw] w-[110vw] rounded-full opacity-[0.22] blur-3xl sm:-bottom-[45vh] sm:-left-[20vw] sm:h-[95vh] sm:w-[95vh]"
        style={{
          backgroundImage: "url('/textures/earth_color.jpg')",
          backgroundSize: '220% 220%',
          backgroundPosition: '35% 20%',
        }}
      />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,#03040a_100%)]" />
    </div>
  )
}
