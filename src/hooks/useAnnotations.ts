/**
 * useAnnotations
 *
 * React hook for managing collaborative annotations.
 */

import { useEffect, useState, useCallback } from 'react'
import { annotationsStore } from '../lib/collaboration/annotationsStore'
import type { Annotation } from '../lib/collaboration/annotationsStore'

/**
 * Target annotation type accepted by the annotations helpers.
 */
export type AnnotationTargetType = Annotation['type'];

/**
 * Update payload accepted when updating an annotation.
 */
export type AnnotationUpdate = Partial<Pick<Annotation, 'content' | 'resolved'>>;

/**
 * Return value of the {@link useAnnotations} hook.
 */
export interface UseAnnotationsReturn {
  annotations: Annotation[];
  isInitialized: boolean;
  addAnnotation: (
    type: AnnotationTargetType,
    targetId: string,
    content: string,
    authorId: string,
    authorName?: string
  ) => Promise<Annotation>;
  updateAnnotation: (id: string, updates: AnnotationUpdate) => Promise<Annotation | null>;
  deleteAnnotation: (id: string) => Promise<boolean>;
  resolveAnnotation: (id: string) => Promise<boolean>;
  getAnnotationsForTarget: (type: AnnotationTargetType, targetId: string) => Annotation[];
  getAnnotationCount: (type: AnnotationTargetType, targetId: string) => number;
}

export function useAnnotations(): UseAnnotationsReturn {
  const [annotations, setAnnotations] = useState<Annotation[]>([])
  const [isInitialized, setIsInitialized] = useState<boolean>(false)

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
    (type: AnnotationTargetType, targetId: string, content: string, authorId: string, authorName?: string): Promise<Annotation> => {
      return annotationsStore.addAnnotation(type, targetId, content, authorId, authorName)
    },
    []
  )

  const updateAnnotation = useCallback((id: string, updates: AnnotationUpdate): Promise<Annotation | null> => {
    return annotationsStore.updateAnnotation(id, updates)
  }, [])

  const deleteAnnotation = useCallback((id: string): Promise<boolean> => {
    return annotationsStore.deleteAnnotation(id)
  }, [])

  const resolveAnnotation = useCallback((id: string): Promise<boolean> => {
    return annotationsStore.resolveAnnotation(id)
  }, [])

  const getAnnotationsForTarget = useCallback((type: AnnotationTargetType, targetId: string): Annotation[] => {
    return annotationsStore.getAnnotationsForTarget(type, targetId)
  }, [])

  const getAnnotationCount = useCallback((type: AnnotationTargetType, targetId: string): number => {
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
