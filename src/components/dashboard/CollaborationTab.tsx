import React from 'react'
import { useStore } from '../../lib/store'
import CollaborativeView from './CollaborativeView'

export default function CollaborationTab() {
  return <CollaborativeView store={useStore} />
}
