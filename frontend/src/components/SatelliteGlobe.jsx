import { Suspense, useMemo, useRef } from 'react'
import { Canvas, useFrame, useLoader } from '@react-three/fiber'
import { Stars, Line } from '@react-three/drei'
import * as THREE from 'three'

const SUN_DIRECTION = new THREE.Vector3(5, 2, 5).normalize()

const dayNightVertex = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldNormal;
  void main() {
    vUv = uv;
    vWorldNormal = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const dayNightFragment = /* glsl */ `
  uniform sampler2D dayTexture;
  uniform sampler2D nightTexture;
  uniform sampler2D specularTexture;
  uniform vec3 sunDirection;
  varying vec2 vUv;
  varying vec3 vWorldNormal;

  void main() {
    float intensity = dot(normalize(vWorldNormal), normalize(sunDirection));
    float mixFactor = smoothstep(-0.18, 0.18, intensity);

    vec3 dayColor = texture2D(dayTexture, vUv).rgb;
    vec3 nightColor = texture2D(nightTexture, vUv).rgb * 1.6;
    float spec = texture2D(specularTexture, vUv).r;

    vec3 color = mix(nightColor, dayColor, mixFactor);
    color += spec * mixFactor * 0.18;

    float terminatorGlow = 1.0 - smoothstep(0.0, 0.22, abs(intensity));
    color += vec3(1.0, 0.55, 0.25) * terminatorGlow * 0.12;

    gl_FragColor = vec4(color, 1.0);
  }
`

function Earth() {
  const meshRef = useRef()
  const cloudsRef = useRef()
  const [colorMap, cloudsMap, specularMap, nightMap] = useLoader(THREE.TextureLoader, [
    '/textures/earth_color.jpg',
    '/textures/earth_clouds.png',
    '/textures/earth_specular.jpg',
    '/textures/earth_lights.png',
  ])

  const uniforms = useMemo(
    () => ({
      dayTexture: { value: colorMap },
      nightTexture: { value: nightMap },
      specularTexture: { value: specularMap },
      sunDirection: { value: SUN_DIRECTION },
    }),
    [colorMap, nightMap, specularMap]
  )

  useFrame((_, delta) => {
    meshRef.current.rotation.y += delta * 0.06
    cloudsRef.current.rotation.y += delta * 0.075
  })

  return (
    <group rotation={[0, 0, THREE.MathUtils.degToRad(-23.4)]}>
      <mesh ref={meshRef}>
        <sphereGeometry args={[1.4, 64, 64]} />
        <shaderMaterial
          uniforms={uniforms}
          vertexShader={dayNightVertex}
          fragmentShader={dayNightFragment}
        />
      </mesh>
      <mesh ref={cloudsRef}>
        <sphereGeometry args={[1.415, 64, 64]} />
        <meshLambertMaterial map={cloudsMap} transparent opacity={0.55} depthWrite={false} />
      </mesh>
      <mesh>
        <sphereGeometry args={[1.46, 48, 48]} />
        <meshBasicMaterial color="#4fb2ff" transparent opacity={0.08} side={THREE.BackSide} />
      </mesh>
    </group>
  )
}

function Satellite() {
  const satRef = useRef()
  const radius = 2.3
  const trailPoints = useRef(
    new Array(64).fill(0).map((_, i) => {
      const a = (i / 64) * Math.PI * 2
      return new THREE.Vector3(Math.cos(a) * radius, Math.sin(a * 0.4) * 0.6, Math.sin(a) * radius)
    })
  ).current

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * 0.5
    const x = Math.cos(t) * radius
    const z = Math.sin(t) * radius
    const y = Math.sin(t * 0.4) * 0.6
    satRef.current.position.set(x, y, z)
    satRef.current.rotation.y = t
  })

  return (
    <group>
      <Line points={trailPoints} color="#60a5fa" opacity={0.3} transparent lineWidth={1} />
      <mesh ref={satRef}>
        <boxGeometry args={[0.09, 0.09, 0.16]} />
        <meshStandardMaterial color="#f8fafc" emissive="#38bdf8" emissiveIntensity={0.6} />
      </mesh>
    </group>
  )
}

export default function SatelliteGlobe({ className = '' }) {
  return (
    <div className={className}>
      <Canvas camera={{ position: [0, 0.6, 4.2], fov: 45 }} dpr={[1, 2]}>
        <Suspense fallback={null}>
          <ambientLight intensity={0.35} />
          <directionalLight position={[5, 2, 5]} intensity={2.2} color="#fff4e0" />
          <Stars radius={40} depth={50} count={1400} factor={2.2} fade speed={0.5} />
          <Earth />
          <Satellite />
        </Suspense>
      </Canvas>
    </div>
  )
}
