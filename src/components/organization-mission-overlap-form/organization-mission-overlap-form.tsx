import { Box, Button, FormControl, InputLabel, MenuItem, Select, TextField, Typography } from "@mui/material"
import { useEffect, useState } from "react"
import { useUpdateOrganizationMissionOverlapMutation } from "../../hooks/use-organization-research-mutations"
import type { DuplicateMissionRole } from "../../types/organization"

interface OrganizationMissionOverlapFormProps {
  organizationId: string
  duplicateMission: string
  duplicateMissionGroup: string
  duplicateMissionRole: DuplicateMissionRole
}

export function OrganizationMissionOverlapForm({
  organizationId,
  duplicateMission,
  duplicateMissionGroup,
  duplicateMissionRole,
}: OrganizationMissionOverlapFormProps) {
  const [duplicateFlag, setDuplicateFlag] = useState(duplicateMission)
  const [groupId, setGroupId] = useState(duplicateMissionGroup)
  const [role, setRole] = useState<DuplicateMissionRole>(duplicateMissionRole)
  const updateMissionOverlap = useUpdateOrganizationMissionOverlapMutation(organizationId)

  useEffect(() => {
    setDuplicateFlag(duplicateMission)
    setGroupId(duplicateMissionGroup)
    setRole(duplicateMissionRole)
  }, [duplicateMission, duplicateMissionGroup, duplicateMissionRole])

  function handleSave() {
    updateMissionOverlap.mutate({
      duplicateMission: duplicateFlag,
      duplicateMissionGroup: groupId,
      duplicateMissionRole: role,
    })
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <Typography color="text.secondary">
        Tag organizations that overlap in mission so Portfolio Review can group them for consolidation. Use a shared group
        id such as <code>dog-transport-ne</code> and mark one as primary.
      </Typography>
      <FormControl fullWidth>
        <InputLabel id="duplicate-mission-label">Overlapping mission?</InputLabel>
        <Select
          labelId="duplicate-mission-label"
          label="Overlapping mission?"
          value={duplicateFlag || "unset"}
          onChange={(event) => setDuplicateFlag(event.target.value === "unset" ? "" : event.target.value)}
        >
          <MenuItem value="unset">Not set</MenuItem>
          <MenuItem value="Y">Yes — overlaps with another org</MenuItem>
          <MenuItem value="N">No — distinct mission</MenuItem>
        </Select>
      </FormControl>
      <TextField
        fullWidth
        label="Overlap group id"
        value={groupId}
        onChange={(event) => setGroupId(event.target.value)}
        placeholder="dog-transport-ne"
        helperText="Use the same group id for organizations that do similar work."
      />
      <FormControl fullWidth>
        <InputLabel id="duplicate-mission-role-label">Role in overlap group</InputLabel>
        <Select
          labelId="duplicate-mission-role-label"
          label="Role in overlap group"
          value={role || "unset"}
          onChange={(event) => setRole((event.target.value === "unset" ? "" : event.target.value) as DuplicateMissionRole)}
        >
          <MenuItem value="unset">Not set</MenuItem>
          <MenuItem value="primary">Primary — main org to keep funding</MenuItem>
          <MenuItem value="secondary">Secondary — keep small if at all</MenuItem>
          <MenuItem value="phasing-out">Phasing out — reduce or pause</MenuItem>
        </Select>
      </FormControl>
      <Box>
        <Button variant="contained" onClick={handleSave} disabled={updateMissionOverlap.isPending}>
          {updateMissionOverlap.isPending ? "Saving..." : "Save mission overlap tags"}
        </Button>
      </Box>
    </Box>
  )
}
