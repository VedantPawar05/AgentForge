const fs = require('fs');

let content = fs.readFileSync('scratch/page_content.tsx', 'utf8');

// 1. Fix refreshTasks
const oldRefresh = `  const refreshTasks = useCallback(async () => {
    if (!selectedWorkspace) return;
    try {
      const fetchedTasks = await apiClient.listTasks(selectedWorkspace.id, {
        projectId: selectedProject?.id,
        limit: 50,
      });
      setTasks(fetchedTasks);
    } catch (err) {
      console.error("Failed to load tasks:", err);
    }
  }, [selectedWorkspace, selectedProject]);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        const wsList = await apiClient.listWorkspaces();
        setWorkspaces(wsList);
        if (wsList.length > 0) {
          const ws = wsList[0];
          setSelectedWorkspace(ws);
          const prjList = await apiClient.listProjects(ws.id);
          setProjects(prjList);
          if (prjList.length > 0) {
            setSelectedProject(prjList[0]);
          }
          const taskList = await apiClient.listTasks(ws.id, { limit: 50 });
          setTasks(taskList);
        }
      } catch (err) {
        console.error("Failed to initialize dashboard:", err);
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);`;

const newRefresh = `  const refreshTasks = useCallback(async () => {
    if (!selectedWorkspace) return;
    try {
      const res = await apiClient.getTasks(selectedWorkspace.id);
      setTasks(res.tasks || []);
    } catch (err) {
      console.error("Failed to load tasks:", err);
    }
  }, [selectedWorkspace]);

  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        const res = await apiClient.getWorkspaces();
        const wsList = (res.workspaces || []).map((w) => w.workspace);
        setWorkspaces(wsList);
        if (wsList.length > 0) {
          const ws = wsList[0];
          setSelectedWorkspace(ws);
          const prjRes = await apiClient.getProjects(ws.id);
          const prjList = prjRes.projects || [];
          setProjects(prjList);
          if (prjList.length > 0) {
            setSelectedProject(prjList[0]);
          }
          const taskRes = await apiClient.getTasks(ws.id);
          setTasks(taskRes.tasks || []);
        }
      } catch (err) {
        console.error("Failed to initialize dashboard:", err);
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, []);`;

content = content.replace(oldRefresh, newRefresh);

// 2. Fix handleCreateTask
const oldCreate = `    setIsSubmittingTask(true);
    try {
      const task = await apiClient.createTask(selectedWorkspace.id, {
        title: newTaskTitle.trim(),
        description: newTaskDesc.trim() || undefined,
        priority: newTaskPriority as any,
        targetBranch: newTaskBranch.trim() || "main",
        projectId: selectedProject?.id,
      });

      // Clear & Close
      setNewTaskTitle("");
      setNewTaskDesc("");
      setIsCreateModalOpen(false);
      setActionSuccessMsg(\`Task "\${task.title}" dispatched successfully!\`);
      setTimeout(() => setActionSuccessMsg(null), 3500);

      // Refresh task list & navigate to Studio to watch squad execution
      await refreshTasks();
      setActiveTab("studio");
      handleExecuteStudioPrompt(\`\${task.title} (model: \${newTaskModel})\`);
    } catch (err: any) {`;

const newCreate = `    setIsSubmittingTask(true);
    try {
      const projectId = selectedProject?.id || (projects.length > 0 ? projects[0].id : "default-project");
      const res = await apiClient.createTask(selectedWorkspace.id, {
        projectId,
        title: newTaskTitle.trim(),
        description: newTaskDesc.trim() || undefined,
        priority: newTaskPriority as any,
        targetBranch: newTaskBranch.trim() || "main",
      });
      const task = res.task;

      // Clear & Close
      setNewTaskTitle("");
      setNewTaskDesc("");
      setIsCreateModalOpen(false);
      setActionSuccessMsg(\`Task "\${task.title}" dispatched successfully!\`);
      setTimeout(() => setActionSuccessMsg(null), 3500);

      // Refresh task list & navigate to Studio to watch squad execution
      await refreshTasks();
      setActiveTab("studio");
      handleExecuteStudioPrompt(\`\${task.title} (model: \${newTaskModel})\`);
    } catch (err: any) {`;

content = content.replace(oldCreate, newCreate);

// 3. Fix handleRunTask
const oldRun = `  const handleRunTask = async (taskId: string, title?: string) => {
    if (!selectedWorkspace) return;
    try {
      await apiClient.createRun(selectedWorkspace.id, taskId, {
        taskInstruction: title,
      });`;

const newRun = `  const handleRunTask = async (taskId: string, title?: string) => {
    if (!selectedWorkspace) return;
    try {
      await apiClient.triggerRun(selectedWorkspace.id, taskId);`;

content = content.replace(oldRun, newRun);

// 4. Fix TaskStatus comparison (COMPLETED -> APPROVED | MERGED)
content = content.replace(/task\.status === "COMPLETED" \|\| task\.status === "APPROVED"/g, 'task.status === "APPROVED" || task.status === "MERGED"');

fs.writeFileSync('scratch/page_content.tsx', content, 'utf8');
fs.writeFileSync('apps/web/src/app/dashboard/page.tsx', content, 'utf8');
console.log('Patched and updated dashboard/page.tsx successfully!');

