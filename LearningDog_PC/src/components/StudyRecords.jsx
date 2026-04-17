import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Typography, Layout, Button, Space, List, Tag, Statistic, Row, Col, message } from 'antd';
import { ArrowLeftOutlined, DownloadOutlined, FireOutlined, ClockCircleOutlined, CalendarOutlined } from '@ant-design/icons';
import { toPng } from 'html-to-image';
import dayjs from 'dayjs';
import { apiGetDailyRecords, apiGetStats, apiGetRecords } from '../utils/api';
import { useApp } from '../App';

const { Title, Text } = Typography;
const { Header, Content } = Layout;

function formatDuration(seconds) {
  if (!seconds) return '0分钟';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}小时${m}分钟`;
  return `${m}分钟`;
}

// Simple calendar heatmap component
function CalendarHeatmap({ data }) {
  const today = dayjs();
  const startDate = today.subtract(364, 'day');
  const dataMap = {};
  (data || []).forEach(d => {
    dataMap[d.date] = d.total_seconds;
  });

  const weeks = [];
  let currentDate = startDate.startOf('week');

  while (currentDate.isBefore(today) || currentDate.isSame(today, 'day')) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      const dateStr = currentDate.format('YYYY-MM-DD');
      const seconds = dataMap[dateStr] || 0;
      const intensity = seconds === 0 ? 0 : seconds < 1800 ? 1 : seconds < 3600 ? 2 : seconds < 7200 ? 3 : 4;
      const colors = ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'];

      week.push(
        <div
          key={dateStr}
          title={`${dateStr}: ${formatDuration(seconds)}`}
          style={{
            width: 12,
            height: 12,
            borderRadius: 2,
            background: currentDate.isAfter(today) ? 'transparent' : colors[intensity],
            cursor: 'pointer',
          }}
        />
      );
      currentDate = currentDate.add(1, 'day');
    }
    weeks.push(
      <div key={`week-${weeks.length}`} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {week}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 2, overflowX: 'auto', padding: '8px 0' }}>
      {weeks}
    </div>
  );
}

export default function StudyRecords() {
  const navigate = useNavigate();
  const { user } = useApp();
  const [daily, setDaily] = useState([]);
  const [stats, setStats] = useState(null);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const posterRef = useRef(null);

  useEffect(() => {
    if (!user?.uuid) return;
    setLoading(true);
    Promise.all([
      apiGetDailyRecords(user.uuid),
      apiGetStats(user.uuid),
      apiGetRecords(user.uuid),
    ]).then(([dailyData, statsData, recordsData]) => {
      setDaily(dailyData);
      setStats(statsData);
      setRecords(recordsData);
    }).catch(err => {
      message.error('获取学习记录失败');
    }).finally(() => setLoading(false));
  }, [user?.uuid]);

  const exportPoster = async () => {
    if (!posterRef.current) return;
    try {
      const dataUrl = await toPng(posterRef.current, { backgroundColor: '#ffffff', pixelRatio: 2 });
      const link = document.createElement('a');
      link.download = `LearningDog_${user.username}_${dayjs().format('YYYY-MM-DD')}.png`;
      link.href = dataUrl;
      link.click();
      message.success('海报已保存');
    } catch (err) {
      message.error('导出失败: ' + err.message);
    }
  };

  const todayRecord = daily.find(d => d.date === dayjs().format('YYYY-MM-DD'));

  return (
    <Layout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      <Header style={{ background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 24px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <Space>
          <Button type="text" icon={<ArrowLeftOutlined />} onClick={() => navigate('/rooms')} />
          <Title level={4} style={{ margin: 0 }}>学习记录</Title>
        </Space>
        <Button icon={<DownloadOutlined />} type="primary" onClick={exportPoster}>导出海报</Button>
      </Header>
      <Content style={{ padding: 24 }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          {/* Stats */}
          {/* Today highlight */}
          <Card style={{ marginBottom: 16, textAlign: 'center' }}>
            <Text type="secondary">今日专注</Text>
            <div style={{ fontSize: 36, fontWeight: 'bold', margin: '8px 0' }}>
              <FireOutlined style={{ color: '#fa8c16', marginRight: 8 }} />
              {todayRecord ? formatDuration(todayRecord.total_seconds) : '0分钟'}
            </div>
          </Card>
          <Row gutter={16} style={{ marginBottom: 24 }}>
            <Col span={8}>
              <Card>
                <Statistic
                  title="累计专注"
                  value={stats ? formatDuration(stats.totalSeconds) : '-'}
                  prefix={<ClockCircleOutlined />}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic
                  title="总天数"
                  value={stats?.totalDays || 0}
                  suffix="天"
                  prefix={<CalendarOutlined />}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card>
                <Statistic
                  title="平均每日"
                  value={stats ? formatDuration(stats.avgDailySeconds) : '-'}
                  prefix={<ClockCircleOutlined />}
                />
              </Card>
            </Col>
          </Row>

          {/* Calendar Heatmap */}
          <Card title="专注日历" style={{ marginBottom: 24 }}>
            <CalendarHeatmap data={daily} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, justifyContent: 'flex-end' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>少</Text>
              {['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'].map(c => (
                <div key={c} style={{ width: 12, height: 12, borderRadius: 2, background: c }} />
              ))}
              <Text type="secondary" style={{ fontSize: 12 }}>多</Text>
            </div>
          </Card>

          {/* Recent Records */}
          <Card title="专注日志">
            <List
              loading={loading}
              dataSource={records.slice(0, 50)}
              locale={{ emptyText: '暂无学习记录' }}
              renderItem={record => (
                <List.Item>
                  <List.Item.Meta
                    title={dayjs(record.start_time).format('YYYY-MM-DD HH:mm')}
                    description={record.end_time ? `结束于 ${dayjs(record.end_time).format('HH:mm')}` : '进行中'}
                  />
                  <Tag color={record.duration_seconds ? 'green' : 'blue'}>
                    {record.duration_seconds ? formatDuration(record.duration_seconds) : '进行中'}
                  </Tag>
                </List.Item>
              )}
            />
          </Card>

          {/* Hidden poster for export */}
          <div style={{ position: 'absolute', left: -9999 }}>
            <div
              ref={posterRef}
              style={{
                width: 400,
                padding: 32,
                background: 'linear-gradient(135deg, #e8f4fd 0%, #ffffff 50%, #dbeafe 100%)',
                color: '#1e293b',
                fontFamily: 'system-ui, sans-serif',
              }}
            >
              <div style={{ textAlign: 'center', marginBottom: 8 }}>
                <div style={{ fontSize: 14, color: '#64748b' }}>{user?.username} 的学习报告</div>
                <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 4 }}>{dayjs().format('YYYY年MM月DD日')}</div>
              </div>
              <div style={{ background: '#2563eb', borderRadius: 16, padding: 28, textAlign: 'center', margin: '16px 0' }}>
                <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 8 }}>今日专注</div>
                <div style={{ fontSize: 42, fontWeight: 'bold', color: '#fff' }}>
                  {todayRecord ? formatDuration(todayRecord.total_seconds) : '0分钟'}
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-around', margin: '20px 0', padding: '0 8px' }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>累计专注</div>
                  <div style={{ fontSize: 16, fontWeight: '600', color: '#334155' }}>{stats ? formatDuration(stats.totalSeconds) : '0分钟'}</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>累计天数</div>
                  <div style={{ fontSize: 16, fontWeight: '600', color: '#334155' }}>{stats?.totalDays || 0} 天</div>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>平均每日</div>
                  <div style={{ fontSize: 16, fontWeight: '600', color: '#334155' }}>{stats ? formatDuration(stats.avgDailySeconds) : '0分钟'}</div>
                </div>
              </div>
              <div style={{ textAlign: 'center', marginTop: 24, paddingTop: 16, borderTop: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: 18, color: '#2563eb', fontWeight: 'bold' }}>🐕 LearningDog</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>在线自习 · 互相监督</div>
              </div>
            </div>
          </div>
        </div>
      </Content>
    </Layout>
  );
}
