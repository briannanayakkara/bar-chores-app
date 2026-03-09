# Supabase Query Patterns

## Basic Select with Filter

```tsx
const { data, error } = await supabase
  .from('tasks')
  .select('*')
  .eq('venue_id', venueId)
  .eq('is_active', true)
  .order('created_at', { ascending: false })
```

## Select with Joins

```tsx
const { data, error } = await supabase
  .from('task_assignments')
  .select(`
    *,
    task:tasks(*),
    assignee:profiles!assigned_to(id, display_name, avatar_url, avatar_config)
  `)
  .eq('venue_id', venueId)
  .eq('status', 'pending')
```

## Upsert

```tsx
const { data, error } = await supabase
  .from('venue_settings')
  .upsert({
    venue_id: venueId,
    primary_color: color,
    updated_at: new Date().toISOString()
  })
  .select()
  .single()
```

## Parallel Queries

```tsx
const [tasksResult, profilesResult] = await Promise.all([
  supabase.from('tasks').select('*').eq('venue_id', venueId),
  supabase.from('profiles').select('*').eq('venue_id', venueId)
])
```

## Edge Function Invocation

```tsx
const { data, error } = await supabase.functions.invoke('admin-actions', {
  body: {
    action: 'create-staff',
    venue_id: venueId,
    username: 'jake',
    display_name: 'Jake',
    pin: '1234'
  }
})

// Edge Functions always return HTTP 200 — check for error in body
if (error || data?.error) {
  logger.error('Action failed', data?.error || error?.message)
  return
}
```

## Storage Upload

```tsx
const filePath = `${venueId}/${Date.now()}_${file.name}`
const { error: uploadError } = await supabase.storage
  .from('task-photos')
  .upload(filePath, file)

// Get public URL (for public buckets)
const { data: { publicUrl } } = supabase.storage
  .from('venue-assets')
  .getPublicUrl(filePath)

// Get signed URL (for private buckets)
const { data: { signedUrl } } = await supabase.storage
  .from('task-photos')
  .createSignedUrl(filePath, 3600)
```

## Realtime Subscription

```tsx
useEffect(() => {
  const channel = supabase
    .channel('points-changes')
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'points_ledger',
      filter: `venue_id=eq.${venueId}`
    }, (payload) => {
      // Handle new points entry
    })
    .subscribe()

  return () => { supabase.removeChannel(channel) }
}, [venueId])
```

## Error Handling Pattern

```tsx
const { data, error } = await supabase.from('tasks').select('*')

if (error) {
  logger.error('Failed to load tasks', error.message)
  setError('Could not load tasks. Please try again.')
  return
}

setTasks(data || [])
```
