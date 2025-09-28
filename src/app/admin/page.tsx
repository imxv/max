'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import Image from 'next/image';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface AdminModel {
  id: string;
  userId: string;
  serviceType: string;
  modelUrl: string | null;
  thumbnailUrl: string | null;
  prompt: string | null;
  creditsCost: number;
  status: string;
  rating: number | null;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
  user: {
    id: string;
    email: string;
    createdAt: string;
  };
}

interface AdminModelsResponse {
  models: AdminModel[];
  total: number;
  stats: {
    totalRatedModels: number;
    averageRating: number;
  };
}

export default function AdminPage() {
  const { user, isLoaded } = useUser();
  const [models, setModels] = useState<AdminModel[]>([]);
  const [stats, setStats] = useState<AdminModelsResponse['stats'] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 模态框状态
  const [selectedModel, setSelectedModel] = useState<AdminModel | null>(null);
  const [showModal, setShowModal] = useState(false);

  // 检查是否为管理员
  const isAdmin = user?.publicMetadata?.role === 'admin';

  useEffect(() => {
    if (isLoaded && !isAdmin) {
      setError('Access denied. Admin privileges required.');
      setLoading(false);
      return;
    }

    if (isLoaded && isAdmin) {
      fetchModels();
    }
  }, [isLoaded, isAdmin]);

  const fetchModels = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/models');

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data: AdminModelsResponse = await response.json();
      setModels(data.models);
      setStats(data.stats);
    } catch (error) {
      console.error('Failed to fetch models:', error);
      setError('Failed to load models');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('zh-CN');
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span
        key={i}
        className={`text-lg ${
          i < rating ? 'text-yellow-400' : 'text-muted-foreground'
        }`}
      >
        ★
      </span>
    ));
  };

  // 打开评价详情模态框
  const openModelDetails = (model: AdminModel) => {
    setSelectedModel(model);
    setShowModal(true);
  };

  // 关闭模态框
  const closeModal = () => {
    setShowModal(false);
    setSelectedModel(null);
  };

  if (!isLoaded) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Card className="w-96 bg-destructive/10 border-destructive/20">
          <CardContent className="p-6 text-center">
            <h2 className="text-xl font-bold text-destructive mb-2">Access Denied</h2>
            <p className="text-destructive/80">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">Loading models...</div>;
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Admin Dashboard</h1>
          <p className="text-muted-foreground">Model ratings and user feedback overview</p>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Models with Ratings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{stats.totalRatedModels}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Average Rating</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  <div className="text-2xl font-bold text-foreground">{stats.averageRating}</div>
                  <div>{renderStars(Math.round(stats.averageRating))}</div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Feedback</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{models.length}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Models Table */}
        <Card>
          <CardHeader>
            <CardTitle>User Model Feedback</CardTitle>
          </CardHeader>
          <CardContent>
            {models.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No models with ratings found
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">User</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Model</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Rating</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Feedback</th>
                      <th className="text-left py-3 px-4 font-medium text-muted-foreground">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {models.map((model) => (
                      <tr key={model.id} className="border-b border-border hover:bg-muted">
                        <td className="py-3 px-4">
                          <div>
                            <div className="text-sm font-medium text-foreground">
                              {model.user.email}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {model.serviceType}
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center space-x-3">
                            {model.thumbnailUrl && (
                              <Image
                                src={model.thumbnailUrl}
                                alt="Model thumbnail"
                                width={48}
                                height={48}
                                className="w-12 h-12 rounded-lg object-cover"
                              />
                            )}
                            <div>
                              <div className="text-sm text-foreground max-w-xs truncate">
                                {model.prompt || 'No prompt'}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                Cost: {model.creditsCost} credits
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          {model.rating ? (
                            <div className="flex items-center space-x-2">
                              <div>{renderStars(model.rating)}</div>
                              <span className="text-sm text-muted-foreground">({model.rating}/5)</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-sm">No rating</span>
                          )}
                        </td>

                        <td className="py-3 px-4">
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              {model.comment ? (
                                <div>
                                  <p className="text-sm text-foreground line-clamp-2 mb-1">
                                    {model.comment}
                                  </p>
                                  {model.comment.length > 100 && (
                                    <button
                                      onClick={() => openModelDetails(model)}
                                      className="text-xs text-primary hover:text-primary/80 underline"
                                    >
                                      查看完整评价
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">No comment</span>
                              )}
                            </div>
                            {(model.rating || model.comment) && (
                              <button
                                onClick={() => openModelDetails(model)}
                                className="ml-2 text-xs text-primary hover:text-primary/80 border border-primary/20 hover:border-primary/40 rounded px-2 py-1 transition-colors"
                              >
                                详情
                              </button>
                            )}
                          </div>
                        </td>

                        <td className="py-3 px-4">
                          <div className="text-sm text-muted-foreground">
                            {formatDate(model.createdAt)}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 评价详情模态框 */}
      {showModal && selectedModel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background border border-border rounded-lg shadow-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              {/* 模态框头部 */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-foreground">模型评价详情</h3>
                <button
                  onClick={closeModal}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* 用户信息 */}
              <div className="mb-6">
                <h4 className="text-lg font-semibold text-foreground mb-2">用户信息</h4>
                <div className="bg-muted rounded-lg p-4">
                  <p className="text-sm text-foreground">
                    <span className="font-medium">邮箱:</span> {selectedModel.user.email}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    <span className="font-medium">服务类型:</span> {selectedModel.serviceType}
                  </p>
                  <p className="text-sm text-muted-foreground mt-1">
                    <span className="font-medium">创建时间:</span> {formatDate(selectedModel.createdAt)}
                  </p>
                </div>
              </div>

              {/* 模型信息 */}
              <div className="mb-6">
                <h4 className="text-lg font-semibold text-foreground mb-2">模型信息</h4>
                <div className="bg-muted rounded-lg p-4">
                  <div className="flex items-start space-x-4">
                    {selectedModel.thumbnailUrl && (
                      <Image
                        src={selectedModel.thumbnailUrl}
                        alt="Model thumbnail"
                        width={80}
                        height={80}
                        className="w-20 h-20 rounded-lg object-cover flex-shrink-0"
                      />
                    )}
                    <div className="flex-1">
                      <p className="text-sm text-foreground mb-2">
                        <span className="font-medium">提示词:</span> {selectedModel.prompt || '无提示词'}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        <span className="font-medium">消耗积分:</span> {selectedModel.creditsCost} 积分
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 评分 */}
              {selectedModel.rating && (
                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-foreground mb-2">用户评分</h4>
                  <div className="bg-muted rounded-lg p-4">
                    <div className="flex items-center space-x-3">
                      <div className="flex items-center space-x-1">
                        {renderStars(selectedModel.rating)}
                      </div>
                      <span className="text-lg font-semibold text-foreground">
                        {selectedModel.rating}/5
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* 评价内容 */}
              {selectedModel.comment && (
                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-foreground mb-2">用户评价</h4>
                  <div className="bg-muted rounded-lg p-4">
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                      {selectedModel.comment}
                    </p>
                  </div>
                </div>
              )}

              {/* 关闭按钮 */}
              <div className="flex justify-end">
                <button
                  onClick={closeModal}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
                >
                  关闭
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}