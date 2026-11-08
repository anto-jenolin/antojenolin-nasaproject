import React from 'react'
import { motion } from 'framer-motion'

interface GlassCardProps {
  children: React.ReactNode
  className?: string
  hover?: boolean
  padding?: string
  style?: React.CSSProperties
}

export default function GlassCard({ children, className = '', hover = true, padding = '24px', style }: GlassCardProps) {
  return (
    <motion.div
      className={`glass-card ${className}`}
      style={{ padding, ...style }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      whileHover={hover ? { y: -2 } : undefined}
    >
      {children}
    </motion.div>
  )
}
