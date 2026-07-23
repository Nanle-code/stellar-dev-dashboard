/**
 * useAnnotations
 *
 * React hook for managing collaborative annotations.
 */

import { useEffect, useState, useCallback } from 'react'
import { annotationsStore } from '../lib/collaboration/annotationsStore'

export function useAnnotations() {
  const [annotations, setAnnotations] = useState([])
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    let mounted = true

    // Initialize annotations store
    annotationsStore.init().then(() => {
      if (mounted) {
        setIsInitialized(true)
      }
    })

    // Subscribe to annotation updates
    const unsubscribe = annotationsStore.subscribe((updatedAnnotations) => {
      if (mounted) {
        setAnnotations(updatedAnnotations)
      }
    })

    return () => {
      mounted = false
      unsubscribe()
      annotationsStore.disconnect()
    }
  }, [])

  const addAnnotation = useCallback(
    (type, targetId, content, authorId, authorName) => {
      return annotationsStore.addAnnotation(type, targetId, content, authorId, authorName)
    },
    []
  )

  const updateAnnotation = useCallback((id, updates) => {
    return annotationsStore.updateAnnotation(id, updates)
  }, [])

  const deleteAnnotation = useCallback((id) => {
    return annotationsStore.deleteAnnotation(id)
  }, [])

  const resolveAnnotation = useCallback((id) => {
    return annotationsStore.resolveAnnotation(id)
  }, [])

  const getAnnotationsForTarget = useCallback((type, targetId) => {
    return annotationsStore.getAnnotationsForTarget(type, targetId)
  }, [])

  const getAnnotationCount = useCallback((type, targetId) => {
    return annotationsStore.getAnnotationCount(type, targetId)
  }, [])

  return {
    annotations,
    isInitialized,
    addAnnotation,
    updateAnnotation,
    deleteAnnotation,
    resolveAnnotation,
    getAnnotationsForTarget,
    getAnnotationCount,
  }
}
